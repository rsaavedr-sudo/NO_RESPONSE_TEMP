/// <reference types="vite/client" />
import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart3, 
  ShieldCheck, 
  History, 
  Zap,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UploadForm } from './components/UploadForm';
import { ProgressBar } from './components/ProgressBar';
import { StatsPanel } from './components/StatsPanel';
import { DownloadButton } from './components/DownloadButton';
import { ErrorAlert } from './components/ErrorAlert';
import { startAnalysis, getDownloadUrl, API_BASE_URL, getJobStatus } from './api/client';
import { JobStatus } from './types/api';

const App: React.FC = () => {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const lastStatusRef = useRef<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastEndpoint, setLastEndpoint] = useState<string>('None');
  const [debugInfo, setDebugInfo] = useState<{
    jobId: string | null;
    status: string | null;
    lastError: string | null;
    timestamp: string;
  }>({ jobId: null, status: null, lastError: null, timestamp: new Date().toLocaleTimeString() });

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    lastStatusRef.current = jobStatus;
  }, [jobStatus]);

  const log = (prefix: string, message: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    const fullMessage = `[${prefix}] ${message}`;
    console.log(`${timestamp} ${fullMessage}`, data || '');
    setDebugInfo(prev => ({
      ...prev,
      timestamp,
      jobId: activeJobId || prev.jobId,
      status: jobStatus?.status || prev.status
    }));
  };

  const handleAnalyze = async (files: File[], analysisDays: number, minFrequency: number) => {
    const totalSize = files.reduce((acc, f) => acc + f.size, 0);
    log('analyze', 'iniciado', { files: files.length, totalSize });
    setLastEndpoint(`POST /analyze`);
    
    // Reset states
    setError(null);
    setActiveJobId(null);
    setJobStatus({
      job_id: 'pending',
      status: 'queued',
      progress_percent: 0,
      stage: 'uploading',
      message: 'Subiendo archivos al servidor...'
    });

    try {
      const { job_id } = await startAnalysis(files, analysisDays, minFrequency);
      log('analyze', 'job_id recibido', job_id);
      
      setActiveJobId(job_id);
      setDebugInfo(prev => ({ ...prev, jobId: job_id, lastError: null }));
      
      // Start polling immediately
      startPolling(job_id);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || 'Unknown error';
      const status = err.response?.status;
      const url = `${API_BASE_URL}/analyze`;
      
      log('analyze', 'upload failed', { 
        url, 
        status, 
        errorMsg, 
        isNetworkError: !err.response,
        data: err.response?.data 
      });
      
      setError(`Error (${status || 'Network'}): ${errorMsg}`);
      setDebugInfo(prev => ({ ...prev, lastError: errorMsg }));
      setJobStatus(null);
    }
  };

  const startPolling = (jobId: string) => {
    log('polling', 'iniciado', { jobId });
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    
    pollIntervalRef.current = setInterval(async () => {
      const endpoint = `/jobs/${jobId}`;
      setLastEndpoint(`GET ${endpoint}`);
      
      try {
        const data = await getJobStatus(jobId);
        log('polling', 'estado', { status: data.status, progress: data.progress_percent });
        setJobStatus(data);
        
        if (data.status === 'completed') {
          log('polling', 'completed', data);
          setError(null);
          log('download', 'enabled', getDownloadUrl(jobId));
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        } else if (data.status === 'failed') {
          log('polling', 'failed', { error: data.error });
          setError(data.error || 'Error en el análisis');
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        }
      } catch (err: any) {
        const errorMsg = err.response?.data?.detail || err.message;
        log('polling', 'error', { errorMsg, status: err.response?.status });
        
        if (err.response?.status === 404) {
          setError('Trabajo no encontrado');
          setDebugInfo(prev => ({ ...prev, lastError: 'Job 404 Not Found' }));
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        } else {
          setError('Error de conexión con el servidor');
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        }
      }
    }, 1500);
  };

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-900 font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-2.5 rounded-xl shadow-lg shadow-blue-200">
              <Zap className="w-7 h-7 text-white fill-white/20" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tighter text-gray-900 leading-none">T-ZERO</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-[0.2em] text-blue-600 uppercase">CDR Analyzer</span>
                <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">v2.0.0</span>
              </div>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-blue-600 cursor-pointer transition-colors">
              <ShieldCheck className="w-4 h-4" />
              Seguridad Enterprise
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-blue-600 cursor-pointer transition-colors">
              <History className="w-4 h-4" />
              Historial
            </div>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* Hero Section */}
        <section className="text-center space-y-4">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-black tracking-tight text-gray-900"
          >
            Análisis Masivo de <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">CDR</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-600 max-w-2xl mx-auto"
          >
            Procesa millones de registros en segundos. Identifica patrones de NO_RESPONSE_TEMP con precisión quirúrgica y arquitectura escalable.
          </motion.p>
        </section>

        <ErrorAlert message={error || jobStatus?.error || ''} onClose={() => setError(null)} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left Column: Form & Progress */}
          <div className="lg:col-span-5 space-y-8">
            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-blue-900/5 border border-gray-100">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Configuración</h2>
              </div>
              
              <UploadForm 
                onAnalyze={handleAnalyze} 
                disabled={jobStatus?.status === 'processing' || jobStatus?.status === 'queued'} 
              />
            </div>

            <AnimatePresence>
              {jobStatus && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white p-8 rounded-3xl shadow-xl shadow-blue-900/5 border border-gray-100"
                >
                  <ProgressBar 
                    percent={jobStatus.progress_percent} 
                    stage={jobStatus.stage} 
                    message={jobStatus.message}
                    status={jobStatus.status}
                  />
                  
                  {jobStatus.status === 'completed' && jobStatus.job_id !== 'pending' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-8"
                    >
                      <DownloadButton 
                        url={getDownloadUrl(jobStatus.job_id)} 
                        filename={`analisis_cdr_${jobStatus.job_id}.csv`} 
                      />
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column: Stats & Info */}
          <div className="lg:col-span-7 space-y-8">
            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-blue-900/5 border border-gray-100 min-h-[400px]">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Estadísticas del Análisis</h2>
                </div>
                {jobStatus?.status === 'processing' && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full animate-pulse">
                    PROCESANDO...
                  </span>
                )}
              </div>

              {jobStatus?.stats ? (
                <StatsPanel stats={jobStatus.stats} />
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400 space-y-4">
                  <BarChart3 className="w-16 h-16 opacity-20" />
                  <p className="text-sm font-medium">Inicia un análisis para ver los resultados aquí.</p>
                </div>
              )}
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl text-white">
                <h3 className="text-lg font-bold mb-2">Arquitectura Backend</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Procesamiento por bloques (chunks) optimizado para archivos de más de 40 millones de filas sin saturar la memoria.
                </p>
              </div>
              <div className="p-6 bg-blue-600 rounded-3xl text-white">
                <h3 className="text-lg font-bold mb-2">Reglas de Negocio</h3>
                <p className="text-sm text-blue-100 leading-relaxed">
                  Filtrado automático de sip_code 200, exclusión por tasa de 404 y validación de frecuencia mínima configurable.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Debug Panel */}
        <div className="bg-gray-900 rounded-2xl p-4 font-mono text-[10px] text-green-400 border border-gray-800 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between mb-2 border-b border-gray-800 pb-2">
            <span className="font-bold text-gray-500 uppercase tracking-widest">Debug Monitor</span>
            <span className="text-gray-600">{debugInfo.timestamp}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">JOB_ID:</span>
              <span className="text-blue-400">{debugInfo.jobId || 'null'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">STATUS:</span>
              <span className={debugInfo.status === 'completed' ? 'text-green-400' : 'text-yellow-400'}>
                {debugInfo.status || 'idle'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">ENDPOINT:</span>
              <span className="text-indigo-400">{lastEndpoint}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">LAST_ERR:</span>
              <span className="text-red-400 truncate max-w-[200px]">{debugInfo.lastError || 'none'}</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 py-10 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3 opacity-50">
            <Zap className="w-5 h-5 text-gray-900" />
            <span className="text-sm font-bold tracking-tighter">T-ZERO TECHNOLOGY</span>
          </div>
          <p className="text-sm text-gray-500">© 2026 T-Zero Technology. Todos los derechos reservados.</p>
          <div className="flex gap-6 text-sm font-medium text-gray-400">
            <a href="#" className="hover:text-blue-600 transition-colors">Documentación</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Soporte</a>
            <a href="#" className="hover:text-blue-600 transition-colors">API</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
