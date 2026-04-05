import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, BarChart3, Activity, Settings, Hash } from 'lucide-react';
import { UploadForm } from '../../components/UploadForm';
import { ProgressBar } from '../../components/ProgressBar';
import { DownloadButton } from '../../components/DownloadButton';
import { ErrorAlert } from '../../components/ErrorAlert';
import { ValidationStatsPanel } from '../../components/ValidationStatsPanel';
import { ValidationPieChart } from '../../components/ValidationPieChart';
import { LineStatePieChart } from '../../components/LineStatePieChart';
import { MatchedRecordsTable } from '../../components/MatchedRecordsTable';
import { startAnalysis, getDownloadUrl, getDetailedDownloadUrl, getJobStatus, cancelAnalysis } from '../../api/client';
import { JobStatus } from '../../types/api';

interface NoResponseValidationModuleProps {
  log: (prefix: string, message: string, data?: any) => void;
  setLastEndpoint: (endpoint: string) => void;
}

export const NoResponseValidationModule: React.FC<NoResponseValidationModuleProps> = ({ log, setLastEndpoint }) => {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [lastFiles, setLastFiles] = useState<File[]>([]);
  const [lastAnalysisDays, setLastAnalysisDays] = useState(7);
  const [lastMinFrequency, setLastMinFrequency] = useState(5);
  const [lastMinTotalFrequency, setLastMinTotalFrequency] = useState(30);
  const [lastMinAvgDailyFrequency, setLastMinAvgDailyFrequency] = useState(5);

  const handleAnalyze = async (
    files: File[], 
    analysisDays: number, 
    minFrequency: number,
    minTotalFrequency?: number,
    minAvgDailyFrequency?: number
  ) => {
    setLastFiles(files);
    setLastAnalysisDays(analysisDays);
    setLastMinFrequency(minFrequency);
    if (minTotalFrequency !== undefined) setLastMinTotalFrequency(minTotalFrequency);
    if (minAvgDailyFrequency !== undefined) setLastMinAvgDailyFrequency(minAvgDailyFrequency);

    const totalSize = files.reduce((acc, f) => acc + f.size, 0);
    log('validation', 'iniciado', { files: files.length, totalSize });
    setLastEndpoint(`POST /api/analyze`);
    
    setError(null);
    setActiveJobId(null);
    setJobStatus({
      job_id: 'pending',
      status: 'queued',
      analysis_type: 'no_response_validation',
      progress_percent: 0,
      stage: 'uploading',
      message: 'Subiendo archivos al servidor...'
    });

    try {
      // In validation mode, files[0] is the target list
      const { job_id } = await startAnalysis(
        files, 
        analysisDays, 
        minFrequency, 
        'no_response_validation',
        minTotalFrequency,
        minAvgDailyFrequency
      );
      log('validation', 'job_id recibido', job_id);
      setActiveJobId(job_id);
      startPolling(job_id);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || 'Unknown error';
      log('validation', 'upload failed', errorMsg);
      setError(`Error: ${errorMsg}`);
      setJobStatus(null);
    }
  };

  const handleRecalculate = () => {
    if (lastFiles.length > 0) {
      handleAnalyze(
        lastFiles, 
        lastAnalysisDays, 
        lastMinFrequency, 
        lastMinTotalFrequency, 
        lastMinAvgDailyFrequency
      );
    }
  };

  const handleCancel = async () => {
    if (!activeJobId) return;
    const confirmCancel = window.confirm('¿Estás seguro que deseas detener la validación?');
    if (!confirmCancel) return;

    log('validation', 'cancel solicitado', { jobId: activeJobId });
    try {
      await cancelAnalysis(activeJobId);
      log('validation', 'cancel exitoso');
    } catch (err: any) {
      log('validation', 'cancel error', err.message);
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
          Validación <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">NO_RESPONSE</span>
        </motion.h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Evalúa la calidad de tu modelo comparando predicciones contra el comportamiento real en CDR.
        </p>
      </section>

      <ErrorAlert message={error || jobStatus?.error || ''} onClose={() => setError(null)} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5 space-y-8">
          <div className="bg-white p-8 rounded-3xl shadow-xl shadow-indigo-900/5 border border-gray-100">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Configuración de Validación</h2>
            </div>
            <UploadForm 
              onAnalyze={handleAnalyze} 
              onCancel={handleCancel}
              disabled={jobStatus?.status === 'processing' || jobStatus?.status === 'queued'} 
              hideMinFrequency={true}
              isValidationMode={true}
            />
          </div>

          <AnimatePresence>
            {jobStatus && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-8 rounded-3xl shadow-xl shadow-indigo-900/5 border border-gray-100"
              >
                <ProgressBar 
                  percent={jobStatus.progress_percent} 
                  stage={jobStatus.stage} 
                  message={jobStatus.message}
                  status={jobStatus.status}
                />
                {jobStatus.status === 'completed' && jobStatus.job_id !== 'pending' && (
                  <div className="mt-8 space-y-3">
                    <DownloadButton 
                      url={getDownloadUrl(jobStatus.job_id)} 
                      filename={`resumen_validacion_${jobStatus.job_id}.csv`} 
                      label="Descargar Resumen (CSV)"
                    />
                    {jobStatus.detailed_result_url && (
                      <div className="pt-2">
                        <DownloadButton 
                          url={getDetailedDownloadUrl(jobStatus.job_id)} 
                          filename={`detalle_cdr_${jobStatus.job_id}.csv`}
                          variant="secondary"
                        />
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-white p-8 rounded-3xl shadow-xl shadow-indigo-900/5 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Lógica de Evaluación</h3>
            <div className="space-y-4 text-sm text-gray-600">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 font-bold">1</div>
                <p><strong>Verdaderos Positivos (TP):</strong> El modelo dijo NO_RESPONSE y el número NO tuvo SIP 200 en los CDR.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0 font-bold">2</div>
                <p><strong>Falsos Positivos (FP):</strong> El modelo dijo NO_RESPONSE pero el número SÍ tuvo al menos un SIP 200.</p>
              </div>
              <div className="pt-4 border-t border-gray-100">
                <p className="font-semibold text-indigo-600">Precisión = TP / (TP + FP)</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-8">
          {jobStatus?.stats ? (
            <>
              <ValidationStatsPanel stats={jobStatus.stats} />
              <ValidationPieChart 
                tp={jobStatus.stats.tp_rows || 0} 
                fp={jobStatus.stats.fp_rows || 0} 
                totalCdr={jobStatus.stats.total_cdr_rows || 0}
              />

              {jobStatus.stats.tp_line_state && (
                <div className="space-y-4">
                  <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                    <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider">
                      Dimensión LineState (Matches TP)
                    </h3>
                    <p className="text-xs text-indigo-600 mt-1">
                      Análisis de comportamiento para los {jobStatus.stats.tp_count?.toLocaleString()} números confirmados como NO_RESPONSE.
                    </p>
                  </div>
                  <LineStatePieChart 
                    inactiva={jobStatus.stats.tp_line_state.inactiva}
                    indeterminada={jobStatus.stats.tp_line_state.indeterminada}
                    activa={jobStatus.stats.tp_line_state.activa}
                    title="Distribución de LineState (Matches TP)"
                  />
                </div>
              )}

              {jobStatus.stats.total_line_state && (
                <div className="space-y-4">
                  <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100">
                    <h3 className="text-sm font-bold text-purple-900 uppercase tracking-wider">
                      Dimensión LineState (Universo Validado)
                    </h3>
                    <p className="text-xs text-purple-600 mt-1">
                      Distribución de estado de línea para los {jobStatus.stats.total_analizados?.toLocaleString()} números analizados en total.
                    </p>
                  </div>
                  <LineStatePieChart 
                    inactiva={jobStatus.stats.total_line_state.inactiva}
                    indeterminada={jobStatus.stats.total_line_state.indeterminada}
                    activa={jobStatus.stats.total_line_state.activa}
                    title="Distribución de LineState (Total Analizado)"
                  />
                </div>
              )}
              {activeJobId && jobStatus.status === 'completed' && (
                <MatchedRecordsTable jobId={activeJobId} />
              )}

              {lastFiles.length > 0 && jobStatus?.status === 'completed' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-8 rounded-3xl shadow-xl shadow-indigo-900/5 border-2 border-indigo-100"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                        <Settings className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Ajuste Fino (Tuning)</h3>
                        <p className="text-xs text-gray-500">Recalcula la validación con nuevos filtros sobre la lista original.</p>
                      </div>
                    </div>
                    <button
                      onClick={handleRecalculate}
                      disabled={jobStatus?.status === 'processing' || jobStatus?.status === 'queued'}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-md active:scale-95 disabled:opacity-50"
                    >
                      Recalcular Análisis
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        <Hash className="w-3 h-3" /> Frecuencia Mínima
                      </label>
                      <input
                        type="number"
                        value={lastMinTotalFrequency}
                        onChange={(e) => setLastMinTotalFrequency(parseInt(e.target.value) || 1)}
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        <Activity className="w-3 h-3" /> Promedio Diario Mínimo
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={lastMinAvgDailyFrequency}
                        onChange={(e) => setLastMinAvgDailyFrequency(parseFloat(e.target.value) || 0.1)}
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </>
          ) : (
            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-indigo-900/5 border border-gray-100 flex flex-col items-center justify-center h-[600px] text-gray-400 space-y-4">
              <BarChart3 className="w-24 h-24 opacity-10" />
              <p className="text-lg font-medium">Inicia una validación para ver el desempeño del modelo.</p>
              <p className="text-sm max-w-xs text-center opacity-60">
                Sube tu lista de objetivos y los CDR correspondientes para calcular las métricas de calidad.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
