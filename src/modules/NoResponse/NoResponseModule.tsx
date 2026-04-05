import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileSpreadsheet, BarChart3 } from 'lucide-react';
import { UploadForm } from '../../components/UploadForm';
import { ProgressBar } from '../../components/ProgressBar';
import { StatsPanel } from '../../components/StatsPanel';
import { DownloadButton } from '../../components/DownloadButton';
import { ErrorAlert } from '../../components/ErrorAlert';
import { NoResponsePieChart } from '../../components/NoResponsePieChart';
import { LineStatePieChart } from '../../components/LineStatePieChart';
import { AnalysisCriteria } from '../../components/AnalysisCriteria';
import { startAnalysis, getDownloadUrl, getJobStatus, cancelAnalysis } from '../../api/client';
import { JobStatus } from '../../types/api';

interface NoResponseModuleProps {
  log: (prefix: string, message: string, data?: any) => void;
  setLastEndpoint: (endpoint: string) => void;
}

export const NoResponseModule: React.FC<NoResponseModuleProps> = ({ log, setLastEndpoint }) => {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleAnalyze = async (files: File[], analysisDays: number, minFrequency: number) => {
    const totalSize = files.reduce((acc, f) => acc + f.size, 0);
    log('no_response', 'iniciado', { files: files.length, totalSize });
    setLastEndpoint(`POST /api/analyze`);
    
    setError(null);
    setActiveJobId(null);
    setJobStatus({
      job_id: 'pending',
      status: 'queued',
      analysis_type: 'no_response',
      progress_percent: 0,
      stage: 'uploading',
      message: 'Subiendo archivos al servidor...'
    });

    try {
      const { job_id } = await startAnalysis(files, analysisDays, minFrequency, 'no_response');
      log('no_response', 'job_id recibido', job_id);
      setActiveJobId(job_id);
      startPolling(job_id);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || 'Unknown error';
      log('no_response', 'upload failed', errorMsg);
      setError(`Error: ${errorMsg}`);
      setJobStatus(null);
    }
  };

  const handleCancel = async () => {
    if (!activeJobId) return;
    const confirmCancel = window.confirm('¿Estás seguro que deseas detener el análisis?');
    if (!confirmCancel) return;

    log('no_response', 'cancel solicitado', { jobId: activeJobId });
    try {
      await cancelAnalysis(activeJobId);
      log('no_response', 'cancel exitoso');
    } catch (err: any) {
      log('no_response', 'cancel error', err.message);
      setError('No se pudo cancelar el proceso');
    }
  };

  const startPolling = (jobId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      setLastEndpoint(`GET /api/jobs/${jobId}`);
      try {
        const data = await getJobStatus(jobId);
        setJobStatus(data);
        if (data.status === 'completed' || data.status === 'failed' || data.status === 'stopped') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        }
      } catch (err: any) {
        setError('Error de conexión con el servidor');
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      }
    }, 1500);
  };

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  return (
    <div className="space-y-10">
      <section className="text-center space-y-4">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl font-black tracking-tight text-gray-900"
        >
          Análisis <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">NO_RESPONSE</span>
        </motion.h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Identifica patrones de NO_RESPONSE_TEMP con precisión quirúrgica y arquitectura escalable.
        </p>
      </section>

      <ErrorAlert message={error || jobStatus?.error || ''} onClose={() => setError(null)} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5 space-y-8">
          <div className="bg-white p-8 rounded-3xl shadow-xl shadow-blue-900/5 border border-gray-100">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-blue-50 rounded-lg">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Configuración NO_RESPONSE</h2>
            </div>
            <UploadForm 
              onAnalyze={handleAnalyze} 
              onCancel={handleCancel}
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
                  <div className="mt-8">
                    <DownloadButton 
                      url={jobStatus.result_url ? `${import.meta.env.VITE_API_BASE_URL || ''}${jobStatus.result_url}` : getDownloadUrl(jobStatus.job_id)} 
                      filename={`analisis_cdr_${jobStatus.job_id}.csv`} 
                    />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="lg:col-span-7 space-y-8">
          <div className="bg-white p-8 rounded-3xl shadow-xl shadow-blue-900/5 border border-gray-100 min-h-[400px]">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Estadísticas</h2>
              </div>
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

          <AnimatePresence>
            {jobStatus?.status === 'completed' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <NoResponsePieChart 
                  conNoResponse={jobStatus.stats?.numeros_con_no_response || 0} 
                  sinNoResponse={jobStatus.stats?.numeros_sin_no_response || 0} 
                />
                <LineStatePieChart 
                  inactiva={jobStatus.stats?.inactiva_count || 0}
                  indeterminada={jobStatus.stats?.indeterminada_count || 0}
                  activa={jobStatus.stats?.activa_count || 0}
                />
              </div>
            )}
          </AnimatePresence>

          <AnalysisCriteria stats={jobStatus?.stats} />
        </div>
      </div>
    </div>
  );
};
