import React, { useState } from 'react';
import { Upload, FileText, Download, AlertCircle, CheckCircle, BarChart2, Calendar } from 'lucide-react';
import { parseCSV } from './utils/parser';
import { validateColumns } from './utils/validator';
import { analyzeCDR } from './utils/analyzer';
import { AnalysisResult } from './types';
import Papa from 'papaparse';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [analysisDays, setAnalysisDays] = useState<number>(7);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const handleProcess = async () => {
    if (!file) {
      setError('Por favor, selecciona un archivo CSV.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const { data, errors } = await parseCSV(file);
      
      if (data.length === 0) {
        setError('El archivo está vacío o no tiene el formato correcto.');
        setIsProcessing(false);
        return;
      }

      const columns = Object.keys(data[0]);
      const validation = validateColumns(columns);

      if (!validation.isValid) {
        setError(`Faltan columnas obligatorias: ${validation.missing.join(', ')}`);
        setIsProcessing(false);
        return;
      }

      const analysisResult = analyzeCDR(data, analysisDays);
      setResult(analysisResult);
    } catch (err) {
      setError('Error al procesar el archivo. Asegúrate de que sea un CSV válido con separador ";"');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;

    const csvData = result.output_data.map(item => ({
      e164: item.e164,
      frequency: item.frequency,
      analysis_days: analysisDays
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `cdr_analysis_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-3">
            <BarChart2 className="w-10 h-10 text-blue-600" />
            CDR Analyzer
          </h1>
          <p className="text-lg text-gray-600">Analizador robusto de Call Detail Records para identificación de NO_RESPONSE_TEMP</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* File Upload Section */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Archivo CDR (CSV; UTF-8)
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                    file ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                  }`}
                >
                  <Upload className={`w-8 h-8 mb-2 ${file ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className="text-sm text-gray-600 font-medium">
                    {file ? file.name : 'Seleccionar archivo CSV'}
                  </span>
                  <span className="text-xs text-gray-400 mt-1">Separador ";" requerido</span>
                </label>
              </div>
            </div>

            {/* Parameters Section */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Parámetros de Análisis
              </label>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex items-center gap-3 mb-2">
                  <Calendar className="w-5 h-5 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Días de análisis (analysis_days)</span>
                </div>
                <input
                  type="number"
                  min="1"
                  value={analysisDays}
                  onChange={(e) => setAnalysisDays(parseInt(e.target.value) || 1)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
                <p className="text-xs text-gray-500 mt-2 italic">Rango: 1 a N días desde la fecha máxima del dataset</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleProcess}
            disabled={isProcessing || !file}
            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-95 ${
              isProcessing || !file
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-200'
            }`}
          >
            {isProcessing ? 'Procesando...' : 'PROCESAR ARCHIVO'}
          </button>

          {error && (
            <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}
        </div>

        {result && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Statistics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard label="Total Números Únicos" value={result.total_numeros_unicos} icon={<FileText className="w-5 h-5" />} />
              <StatCard label="Excluidos (SIP 200)" value={result.numeros_excluidos_200} color="text-orange-600" />
              <StatCard label="Excluidos (SIP 404 > 30%)" value={result.numeros_excluidos_404} color="text-red-600" />
              <StatCard label="Números Analizados" value={result.numeros_analizados} color="text-blue-600" />
              <StatCard label="Match (NO_RESPONSE_TEMP)" value={result.numeros_match} color="text-green-600" icon={<CheckCircle className="w-5 h-5" />} />
              <StatCard label="No Match" value={result.numeros_no_match} color="text-gray-500" />
            </div>

            {result.discarded_rows > 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Se descartaron <strong>{result.discarded_rows}</strong> filas por errores de formato o fecha.
              </div>
            )}

            {/* Results Table & Download */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="p-6 border-bottom border-gray-100 flex items-center justify-between bg-gray-50">
                <h3 className="text-lg font-bold text-gray-900">Resultados del Análisis</h3>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm transition-all shadow-md hover:shadow-green-100"
                >
                  <Download className="w-4 h-4" />
                  Descargar CSV
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-white sticky top-0 shadow-sm">
                    <tr>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b">e164</th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b">Frequency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.output_data.slice(0, 100).map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-mono text-gray-900">{item.e164}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-600">{item.frequency}</td>
                      </tr>
                    ))}
                    {result.output_data.length > 100 && (
                      <tr>
                        <td colSpan={2} className="px-6 py-4 text-xs text-gray-400 text-center italic">
                          Mostrando los primeros 100 resultados de {result.output_data.length}
                        </td>
                      </tr>
                    )}
                    {result.output_data.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-6 py-12 text-center text-gray-500">
                          No se encontraron números que cumplan los criterios.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'text-gray-900', icon }: { label: string; value: number; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-2 text-gray-400">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <div className={`text-2xl font-black ${color}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}
