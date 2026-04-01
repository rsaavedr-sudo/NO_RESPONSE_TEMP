import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import csv from "csv-parser";
import fs from "fs-extra";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const upload = multer({ dest: "uploads/" });
const TEMP_DIR = "temp";

fs.ensureDirSync(TEMP_DIR);
fs.ensureDirSync("uploads");

async function startServer() {
  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API Routes
  app.post("/api/analyze", upload.single("file"), async (req, res) => {
    const file = req.file;
    const analysisDays = parseInt(req.body.analysis_days || "30");
    const minFrequency = parseInt(req.body.min_frequency || "5");

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    try {
      // Pass 1: Find maxDate
      let maxDate: Date | null = null;
      let totalRows = 0;
      let invalidRows = 0;

      await new Promise((resolve, reject) => {
        fs.createReadStream(file.path)
          .pipe(csv({ separator: ";" }))
          .on("data", (row) => {
            totalRows++;
            const dateStr = row.call_date;
            if (dateStr) {
              const date = new Date(dateStr);
              if (!isNaN(date.getTime())) {
                if (!maxDate || date > maxDate) {
                  maxDate = date;
                }
              } else {
                invalidRows++;
              }
            } else {
              invalidRows++;
            }
          })
          .on("end", resolve)
          .on("error", reject);
      });

      if (!maxDate) {
        return res.status(400).json({ error: "No valid dates found in CSV" });
      }

      const cutoffDate = new Date(maxDate);
      cutoffDate.setDate(cutoffDate.getDate() - analysisDays);

      // Pass 2: Accumulate stats
      const statsMap = new Map<string, { total: number; c404: number; has200: boolean; freqInWindow: number }>();

      await new Promise((resolve, reject) => {
        fs.createReadStream(file.path)
          .pipe(csv({ separator: ";" }))
          .on("data", (row) => {
            const dateStr = row.call_date;
            if (!dateStr) return;
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return;

            const e164 = String(row.e164 || "unknown");
            const sip = String(row.sip_code || "").trim();

            if (!statsMap.has(e164)) {
              statsMap.set(e164, { total: 0, c404: 0, has200: false, freqInWindow: 0 });
            }

            const s = statsMap.get(e164)!;
            s.total++;
            if (sip === "200") s.has200 = true;
            if (sip === "404") s.c404++;
            if (date >= cutoffDate) {
              s.freqInWindow++;
            }
          })
          .on("end", resolve)
          .on("error", reject);
      });

      // Final classification
      const results: any[] = [];
      let excl200 = 0;
      let excl404 = 0;
      let insufficientFreq = 0;
      let matchCount = 0;
      let noMatchCount = 0;

      statsMap.forEach((s, e164) => {
        const pct404 = s.total > 0 ? s.c404 / s.total : 0;
        const isMatch = !s.has200 && pct404 <= 0.30 && s.freqInWindow >= minFrequency;

        const status = isMatch ? "NO_RESPONSE_TEMP" : "OTHER";

        if (isMatch) {
          matchCount++;
        } else {
          if (s.has200) excl200++;
          else if (pct404 > 0.30) excl404++;
          else if (s.freqInWindow < minFrequency) insufficientFreq++;
          noMatchCount++;
        }

        results.push({
          e164,
          frequency: s.freqInWindow,
          pct_404: `${(pct404 * 100).toFixed(2)}%`,
          status,
        });
      });

      const jobId = uuidv4();
      const outputPath = path.join(TEMP_DIR, `results_${jobId}.csv`);
      
      // Write result CSV
      const header = "e164;frequency;pct_404;status\n";
      const rows = results.map(r => `${r.e164};${r.frequency};${r.pct_404};${r.status}`).join("\n");
      await fs.writeFile(outputPath, header + rows);

      const summary = {
        total_registros: totalRows,
        total_numeros_unicos: statsMap.size,
        numeros_excluidos_200: excl200,
        numeros_excluidos_404: excl404,
        numeros_con_frecuencia_insuficiente: insufficientFreq,
        numeros_match: matchCount,
        numeros_no_match: noMatchCount,
        filas_invalidas_descartadas: invalidRows,
      };

      res.json({ job_id: jobId, stats: summary });
    } catch (error: any) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: error.message });
    } finally {
      // Clean up upload
      if (file && file.path) {
        await fs.remove(file.path).catch(console.error);
      }
    }
  });

  app.get("/api/download/:jobId", async (req, res) => {
    const { jobId } = req.params;
    const filePath = path.join(TEMP_DIR, `results_${jobId}.csv`);
    if (await fs.pathExists(filePath)) {
      res.download(filePath, `cdr_analysis_results_${jobId}.csv`);
    } else {
      res.status(404).json({ error: "Result file not found" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
