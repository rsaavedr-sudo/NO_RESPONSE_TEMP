import React, { useState } from 'react';
import { 
  Upload, 
  Settings, 
  Download, 
  AlertCircle, 
  Loader2,
  BarChart3,
  Info
} from 'lucide-react';
import axios from 'axios';
import { AnalysisResult } from './types';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [analysisDays, setAnalysisDays] = useState<number>(30);
  const [minFrequency, setMinFrequency] = useState<number>(5);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setResult(null);
      setJobId(null);
    }
  };

  const handleProcess = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('analysis_days', analysisDays.toString());
    formData.append('min_frequency', minFrequency.toString());

    try {
      const response = await axios.post('/api/analyze', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setResult(response.data.stats);
      setJobId(response.data.job_id);
    } catch (err: any) {
      console.error('Analysis error:', err);
      setError(err.response?.data?.error || err.message || 'Error al procesar el archivo');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!jobId) return;
    window.location.href = `/api/download/${jobId}`;
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-gray-100 font-sans">
      {/* Logo Section */}
      <div className="absolute top-6 left-8 flex items-center gap-2">
        <div className="w-10 h-10 bg-[#00ff00] rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(0,255,0,0.3)]">
          <span className="text-[#1a1a1a] font-bold text-xl">T</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-bold tracking-tight text-white leading-none">T-Zero</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium tracking-[0.2em] text-[#00ff00] uppercase">Technology</span>
            <span className="text-[10px] font-mono text-gray-600 bg-gray-800/50 px-1.5 py-0.5 rounded">v2.0.0</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-24">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Análisis de CDR Masivo
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Procesamiento de archivos de gran escala (millones de registros) para la detección de números sin respuesta temporal.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Configuration Panel */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-[#242424] p-6 rounded-2xl border border-gray-800 shadow-xl">
              <div className="flex items-center gap-2 mb-6 text-[#00ff00]">
                <Settings size={20} />
                <h2 className="font-semibold uppercase tracking-wider text-sm">Configuración</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-2">
                    Ventana de Análisis (Días)
                  </label>
                  <input
                    type="number"
                    value={analysisDays}
                    onChange={(e) => setAnalysisDays(parseInt(e.target.value) || 1)}
                    className="w-full bg-[#1a1a1a] border border-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:border-[#00ff00] transition-colors"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-2">
                    Frecuencia Mínima
                  </label>
                  <input
                    type="number"
                    value={minFrequency}
                    onChange={(e) => setMinFrequency(parseInt(e.target.value) || 1)}
                    className="w-full bg-[#1a1a1a] border border-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:border-[#00ff00] transition-colors"
                    min="1"
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#242424] p-6 rounded-2xl border border-gray-800 shadow-xl">
              <div className="flex items-center gap-2 mb-4 text-gray-400">
                <Info size={18} />
                <h3 className="text-sm font-medium">Reglas de Negocio</h3>
              </div>
              <ul className="text-xs text-gray-500 space-y-2 list-disc pl-4">
                <li>Excluye números con algún sip_code = 200</li>
                <li>Excluye números con &gt;30% de sip_code = 404</li>
                <li>Requiere frecuencia mínima de {minFrequency} en los últimos {analysisDays} días</li>
              </ul>
            </div>
          </div>

          {/* Main Action Area */}
          <div className="md:col-span-2 space-y-8">
            <div 
              className={`relative border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-300 ${
                file ? 'border-[#00ff00] bg-[#00ff00]/5' : 'border-gray-800 hover:border-gray-700 bg-[#242424]'
              }`}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                  file ? 'bg-[#00ff00] text-[#1a1a1a]' : 'bg-[#1a1a1a] text-gray-600'
                }`}>
                  <Upload size={32} />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  {file ? file.name : 'Seleccionar archivo CSV'}
                </h3>
                <p className="text-gray-500 text-sm">
                  {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : 'Arrastra tu archivo aquí o haz clic para buscar'}
                </p>
              </div>
            </div>

            <button
              onClick={handleProcess}
              disabled={!file || isProcessing}
              className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300 ${
                !file || isProcessing
                  ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                  : 'bg-[#00ff00] text-[#1a1a1a] hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(0,255,0,0.2)]'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" />
                  Procesando en Servidor...
                </>
              ) : (
                <>
                  <BarChart3 size={24} />
                  Iniciar Análisis
                </>
              )}
            </button>

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl flex items-start gap-3 text-red-400">
                <AlertCircle className="shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {result && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatCard label="Total Registros" value={result.total_registros.toLocaleString()} />
                  <StatCard label="Números Únicos" value={result.total_numeros_unicos.toLocaleString()} />
                  <StatCard label="Match (NO_RESPONSE_TEMP)" value={result.numeros_match.toLocaleString()} highlight />
                  <StatCard label="No Match" value={result.numeros_no_match.toLocaleString()} />
                </div>

                <div className="bg-[#242424] p-6 rounded-2xl border border-gray-800">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                    <AlertCircle size={16} />
                    Detalle de Exclusiones
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                    <ExclusionItem label="SIP 200 Detectado" value={result.numeros_excluidos_200} />
                    <ExclusionItem label="SIP 404 > 30%" value={result.numeros_excluidos_404} />
                    <ExclusionItem label="Frecuencia Insuficiente" value={result.numeros_con_frecuencia_insuficiente} />
                  </div>
                </div>

                <button
                  onClick={handleDownload}
                  className="w-full py-4 bg-white text-[#1a1a1a] rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
                >
                  <Download size={20} />
                  Descargar Resultados Completos (CSV)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-4 rounded-xl border ${highlight ? 'border-[#00ff00] bg-[#00ff00]/5' : 'border-gray-800 bg-[#242424]'}`}>
      <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">{label}</p>
      <p className={`text-xl font-bold ${highlight ? 'text-[#00ff00]' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function ExclusionItem({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-bold text-white mb-1">{value.toLocaleString()}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

export default App;
