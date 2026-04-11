import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileSpreadsheet, BarChart3, Settings, Database, Info, Terminal, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { UploadForm } from '../../components/UploadForm';
import { ProgressBar } from '../../components/ProgressBar';
import { StatsPanel } from '../../components/StatsPanel';
import { DownloadButton } from '../../components/DownloadButton';
import { ErrorAlert } from '../../components/ErrorAlert';
import { NoResponsePieChart } from '../../components/NoResponsePieChart';
import { LineStatePieChart } from '../../components/LineStatePieChart';
import { AnalysisCriteria } from '../../components/AnalysisCriteria';
import { JobLogsModal } from '../../components/JobLogsModal';
import { ProcessedBatchesTable } from '../../components/ProcessedBatchesTable';
import { DuplicateFilesModal } from '../../components/DuplicateFilesModal';
import { 
  startAnalysis, 
  getDownloadUrl, 
  getJobStatus, 
  cancelAnalysis, 
  getLastJobStatus,
  checkDuplicates,
  getProcessedBatches
} from '../../api/client';
import { JobStatus, ProcessedBatch, DuplicateCheckResponse } from '../../types/api';

interface NoResponseModuleProps {
  log: (prefix: string, message: string, data?: any) => void;
  setLastEndpoint: (endpoint: string) => void;
}

export const NoResponseModule: React.FC<NoResponseModuleProps> = ({ log, setLastEndpoint }) => {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [activeTab, setActiveTab] = useState<'analysis' | 'processed'>('analysis');
  const [processedBatches, setProcessedBatches] = useState<ProcessedBatch[]>([]);
  const [isBatchesLoading, setIsBatchesLoading] = useState(false);
  const [duplicateCheck, setDuplicateCheck] = useState<DuplicateCheckResponse | null>(null);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [pendingAnalysisParams, setPendingAnalysisParams] = useState<any>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProcessedBatches = async () => {
    setIsBatchesLoading(true);
    try {
      const data = await getProcessedBatches();
      setProcessedBatches(data);
    } catch (err) {
      console.error('Error fetching processed batches:', err);
    } finally {
      setIsBatchesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'processed') {
      fetchProcessedBatches();
    }
  }, [activeTab]);

  const handleAnalyze = async (
    files: File[], 
    analysisDays: number, 
    minFrequency: number,
    minTotalFrequency?: number,
    minAvgDailyFrequency?: number,
    useHistory: boolean = true,
    historyDays: number = 30
  ) => {
    const params = { files, analysisDays, minFrequency, minTotalFrequency, minAvgDailyFrequency, useHistory, historyDays };
    setPendingAnalysisParams(params);

    // If no files selected, it's a history-only analysis
    if (files.length === 0) {
      executeAnalysis(params);
      return;
    }

    try {
      // 1. Check for duplicates first
      const dupResult = await checkDuplicates(files);
      if (dupResult.has_duplicates) {
        setDuplicateCheck(dupResult);
        setIsDuplicateModalOpen(true);
        return; // Wait for user confirmation
      }

      // 2. No duplicates, proceed normally
      executeAnalysis(params);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || 'Error al verificar duplicados';
      setError(`Error: ${errorMsg}`);
    }
  };

  const executeAnalysis = async (params: any) => {
    const { files, analysisDays, minFrequency, useHistory, historyDays } = params;
    
    const totalSize = files.reduce((acc: number, f: File) => acc + f.size, 0);
    log('no_response', 'iniciado', { files: files.length, totalSize, useHistory, historyDays });
    setLastEndpoint(`POST /api/analyze`);
    
    // Clear previous state completely
    setError(null);
    setActiveJobId(null);
    setJobStatus({
      job_id: 'pending',
      status: 'queued',
      analysis_type: 'no_response',
      progress_percent: 0,
      stage: 'uploading',
      message: files.length > 0 ? 'Subiendo archivos al servidor...' : 'Iniciando análisis histórico...',
      use_history: useHistory,
      history_days: historyDays
    });

    try {
      const { job_id } = await startAnalysis(
        files, 
        analysisDays, 
        minFrequency, 
        'no_response',
        undefined,
        undefined,
        useHistory,
        historyDays
      );
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
          pollIntervalRef.current = null;
          setActiveJobId(null);
          
          if (data.status === 'completed') {
            log('no_response', 'completado', data.stats);
            // Refresh processed batches
            fetchProcessedBatches();
          }
        }
      } catch (err: any) {
        setError('Error de conexión con el servidor');
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      }
    }, 1500);
  };

  useEffect(() => {
    const fetchLastJob = async () => {
      // Don't restore if we are already polling or have a pending job
      if (activeJobId) return;

      try {
        const lastJob = await getLastJobStatus('no_response');
        if (lastJob) {
          setJobStatus(lastJob);
          setActiveJobId(lastJob.job_id);
          log('no_response', 'último análisis restaurado', lastJob.job_id);
          
          // If it was still running, resume polling
          if (lastJob.status === 'processing' || lastJob.status === 'queued') {
            startPolling(lastJob.job_id);
          }
        }
      } catch (err) {
        // No last job found, ignore
      }
    };
    fetchLastJob();

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

        <div className="flex justify-center mt-8">
          <div className="inline-flex p-1 bg-gray-100 rounded-2xl border border-gray-200">
            <button
              onClick={() => setActiveTab('analysis')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                activeTab === 'analysis' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Análisis
            </button>
            <button
              onClick={() => setActiveTab('processed')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                activeTab === 'processed' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Database className="w-4 h-4" />
              Archivos Procesados
            </button>
          </div>
        </div>
      </section>

      <ErrorAlert message={error || jobStatus?.error || ''} onClose={() => setError(null)} />

      {activeTab === 'analysis' ? (
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
                showIncrementalOptions={true}
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
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Job ID: {jobStatus.job_id}
                    </span>
                    {jobStatus.status === 'processing' && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[9px] font-bold animate-pulse">
                        EN EJECUCIÓN
                      </span>
                    )}
                  </div>

                  <ProgressBar 
                    percent={jobStatus.progress_percent} 
                    stage={jobStatus.stage} 
                    message={jobStatus.message}
                    status={jobStatus.status}
                  />

                  {jobStatus.stage === 'loading_history' && jobStatus.progress_percent === 0 && (
                    <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-3 text-indigo-800 text-xs animate-pulse">
                      <Info className="w-4 h-4" />
                      <span>Ejecutando análisis basado en datos históricos previamente procesados</span>
                    </div>
                  )}
                  
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button 
                      onClick={() => setShowLogs(true)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-2xl text-sm font-bold hover:bg-gray-800 transition-all active:scale-95"
                    >
                      <Terminal className="w-4 h-4" />
                      Ver Logs
                    </button>
                    
                    {jobStatus.status === 'completed' && jobStatus.job_id !== 'pending' && (
                      <DownloadButton 
                        url={jobStatus.result_url ? `${import.meta.env.VITE_API_BASE_URL || ''}${jobStatus.result_url}` : getDownloadUrl(jobStatus.job_id)} 
                        filename={`analisis_cdr_${jobStatus.job_id}.csv`} 
                      />
                    )}
                  </div>
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
                <div className="space-y-8">
                  {(jobStatus.files_skipped?.length > 0 || jobStatus.days_considered?.length > 0) && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex flex-col gap-3"
                    >
                      <div className="flex items-center gap-2 text-blue-800 font-bold text-xs uppercase tracking-wider">
                        <Settings className="w-4 h-4" />
                        Detalles del Análisis Incremental
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {jobStatus.files_skipped?.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-blue-600 uppercase">Archivos Omitidos (Deduplicados)</p>
                            <ul className="text-[10px] text-blue-800 list-disc list-inside max-h-20 overflow-y-auto">
                              {jobStatus.files_skipped.map((f, i) => <li key={i}>{f}</li>)}
                            </ul>
                          </div>
                        )}
                        {jobStatus.days_considered?.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-blue-600 uppercase">Días Considerados</p>
                            <div className="flex flex-wrap gap-1">
                              {jobStatus.days_considered.map((d, i) => (
                                <span key={i} className="px-1.5 py-0.5 bg-blue-200 text-blue-800 rounded text-[9px] font-medium">
                                  {d}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

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
                </div>
              )}
            </AnimatePresence>

            <AnalysisCriteria stats={jobStatus?.stats} />
          </div>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Database className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Histórico de Lotes Ingeridos</h2>
                <p className="text-sm text-gray-500">Archivos que ya forman parte de la base de datos incremental.</p>
              </div>
            </div>
            <button 
              onClick={fetchProcessedBatches}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Actualizar lista"
            >
              <Settings className={`w-5 h-5 text-gray-400 ${isBatchesLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <ProcessedBatchesTable batches={processedBatches} isLoading={isBatchesLoading} />
        </motion.div>
      )}

      <AnimatePresence>
        {showLogs && jobStatus && (
          <JobLogsModal job={jobStatus} onClose={() => setShowLogs(false)} />
        )}
      </AnimatePresence>

      <DuplicateFilesModal 
        isOpen={isDuplicateModalOpen}
        onClose={() => setIsDuplicateModalOpen(false)}
        onConfirm={() => {
          setIsDuplicateModalOpen(false);
          if (pendingAnalysisParams) {
            executeAnalysis(pendingAnalysisParams);
          }
        }}
        duplicates={duplicateCheck?.results || []}
      />
    </div>
  );
};
