import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileSpreadsheet, BarChart3, Activity } from 'lucide-react';
import { UploadForm } from '../../components/UploadForm';
import { ProgressBar } from '../../components/ProgressBar';
import { DownloadButton } from '../../components/DownloadButton';
import { ErrorAlert } from '../../components/ErrorAlert';
import { ASRPieChart } from '../../components/ASRPieChart';
import { ASRCriteria } from '../../components/ASRCriteria';
import { ASRStatsPanel } from '../../components/ASRStatsPanel';
import { ASRDimensionCharts } from '../../components/ASRDimensionCharts';
import { startAnalysis, getDownloadUrl, getJobStatus, cancelAnalysis } from '../../api/client';
import { JobStatus } from '../../types/api';

interface ASRModuleProps {
  log: (prefix: string, message: string, data?: any) => void;
  setLastEndpoint: (endpoint: string) => void;
}

export const ASRModule: React.FC<ASRModuleProps> = ({ log, setLastEndpoint }) => {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleAnalyze = async (files: File[], analysisDays: number, minFrequency: number) => {
    const totalSize = files.reduce((acc, f) => acc + f.size, 0);
    log('asr', 'iniciado', { files: files.length, totalSize });
    setLastEndpoint(`POST /analyze`);
    
    setError(null);
    setActiveJobId(null);
    setJobStatus({
      job_id: 'pending',
      status: 'queued',
      analysis_type: 'asr',
      progress_percent: 0,
      stage: 'uploading',
      message: 'Subiendo archivos al servidor...'
    });

    try {
      const { job_id } = await startAnalysis(files, analysisDays, minFrequency, 'asr');
      log('asr', 'job_id recibido', job_id);
      setActiveJobId(job_id);
      startPolling(job_id);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || 'Unknown error';
      log('asr', 'upload failed', errorMsg);
      setError(`Error: ${errorMsg}`);
      setJobStatus(null);
    }
  };

  const handleCancel = async () => {
    if (!activeJobId) return;
    const confirmCancel = window.confirm('¿Estás seguro que deseas detener el análisis?');
    if (!confirmCancel) return;

    log('asr', 'cancel solicitado', { jobId: activeJobId });
    try {
      await cancelAnalysis(activeJobId);
      log('asr', 'cancel exitoso');
    } catch (err: any) {
      log('asr', 'cancel error', err.message);
      setError('No se pudo cancelar el proceso');
    }
  };

  const startPolling = (jobId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      setLastEndpoint(`GET /jobs/${jobId}`);
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
          Análisis <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600">ASR</span>
        </motion.h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Módulo independiente para el cálculo de Answer Seizure Ratio y análisis de efectividad por dimensiones.
        </p>
      </section>

      <ErrorAlert message={error || jobStatus?.error || ''} onClose={() => setError(null)} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5 space-y-8">
          <div className="bg-white p-8 rounded-3xl shadow-xl shadow-green-900/5 border border-gray-100">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-green-50 rounded-lg">
                <Activity className="w-5 h-5 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Configuración ASR</h2>
            </div>
            <UploadForm 
              onAnalyze={handleAnalyze} 
              onCancel={handleCancel}
              disabled={jobStatus?.status === 'processing' || jobStatus?.status === 'queued'} 
              hideMinFrequency={true}
            />
          </div>

          <AnimatePresence>
            {jobStatus && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-8 rounded-3xl shadow-xl shadow-green-900/5 border border-gray-100"
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
                      url={getDownloadUrl(jobStatus.job_id)} 
                      filename={`analisis_asr_${jobStatus.job_id}.csv`} 
                    />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <ASRCriteria stats={jobStatus?.stats} />
        </div>

        <div className="lg:col-span-7 space-y-8">
          {jobStatus?.stats ? (
            <>
              <ASRStatsPanel stats={jobStatus.stats} />
              <div className="grid grid-cols-1 gap-8">
                <ASRPieChart 
                  atendidos={jobStatus.stats.intentos_atendidos || 0} 
                  noAtendidos={jobStatus.stats.intentos_no_atendidos || 0} 
                />
                <ASRDimensionCharts stats={jobStatus.stats} />
              </div>
            </>
          ) : (
            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-green-900/5 border border-gray-100 flex flex-col items-center justify-center h-[600px] text-gray-400 space-y-4">
              <BarChart3 className="w-24 h-24 opacity-10" />
              <p className="text-lg font-medium">Inicia un análisis ASR para ver los resultados aquí.</p>
              <p className="text-sm max-w-xs text-center opacity-60">
                Los resultados se visualizarán en tiempo real una vez que el proceso comience.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
