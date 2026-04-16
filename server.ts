import express from "express";
import { createServer as createViteServer } from "vite";
import { createProxyMiddleware } from "http-proxy-middleware";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const BACKEND_URL = process.env.BACKEND_URL || "";

async function startServer() {
  // Health check for the Express server itself
  app.get("/healthz", (req, res) => {
    res.json({ status: "ok", mode: BACKEND_URL ? "proxy" : "unified" });
  });

  // Proxy API requests to FastAPI backend if BACKEND_URL is provided
  if (BACKEND_URL) {
    app.use(
      "/api",
      createProxyMiddleware({
        target: BACKEND_URL,
        changeOrigin: true,
        proxyTimeout: 300000, // 5 minutes
        timeout: 300000,      // 5 minutes
        on: {
          proxyReq: (proxyReq, req, res) => {
            console.log(`[Proxy] ${req.method} ${req.url}`);
          },
          error: (err, req, res) => {
            console.error(`[Proxy Error] ${err.message}`);
          }
        }
      })
    );
  } else {
    console.log("[Server] No BACKEND_URL provided. Running in unified local mode.");
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      configFile: path.resolve(__dirname, "vite.config.mjs"),
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // Explicit SPA fallback for development
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
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
