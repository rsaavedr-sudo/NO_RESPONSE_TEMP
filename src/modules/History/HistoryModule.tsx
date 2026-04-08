import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  History, 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  Eye, 
  RefreshCw,
  Calendar,
  Database,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  FileJson,
  ArrowRight,
  BarChart2,
  ShieldCheck,
  Terminal
} from 'lucide-react';
import { getHistory, deleteHistoryItem, getDownloadUrl, getDetailedDownloadUrl } from '../../api/client';
import { JobStatus } from '../../types/api';
import { JobLogsModal } from '../../components/JobLogsModal';
import { formatDateTime } from '../../lib/dateUtils';

export const HistoryModule: React.FC = () => {
  const [history, setHistory] = useState<JobStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<JobStatus | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await getHistory();
      setHistory(data);
      setError(null);
    } catch (err) {
      setError('Error al cargar el historial de análisis.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (jobId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este análisis? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await deleteHistoryItem(jobId);
      setHistory(prev => prev.filter(item => item.job_id !== jobId));
      if (selectedJob?.job_id === jobId) setSelectedJob(null);
    } catch (err) {
      alert('Error al eliminar el análisis.');
    }
  };

  const filteredHistory = history.filter(item => {
    const matchesSearch = item.job_id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         item.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || item.analysis_type === filterType;
    return matchesSearch && matchesType;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'processing': return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'queued': return <Clock className="w-4 h-4 text-gray-400" />;
      case 'cleaned': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5";
    switch (status) {
      case 'completed': return <span className={`${baseClasses} bg-green-50 text-green-700 border border-green-100`}>{getStatusIcon(status)} Completado</span>;
      case 'failed': return <span className={`${baseClasses} bg-red-50 text-red-700 border border-red-100`}>{getStatusIcon(status)} Fallido</span>;
      case 'processing': return <span className={`${baseClasses} bg-blue-50 text-blue-700 border border-blue-100`}>{getStatusIcon(status)} Procesando</span>;
      case 'queued': return <span className={`${baseClasses} bg-gray-50 text-gray-700 border border-gray-100`}>{getStatusIcon(status)} En Cola</span>;
      case 'cleaned': return <span className={`${baseClasses} bg-yellow-50 text-yellow-700 border border-yellow-100`}>{getStatusIcon(status)} Limpiado</span>;
      default: return <span className={`${baseClasses} bg-gray-50 text-gray-700 border border-gray-100`}>{getStatusIcon(status)} {status}</span>;
    }
  };

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3 text-blue-600 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <History className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest">Gestión de Datos</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-gray-900">Historial de Análises</h1>
          <p className="text-gray-500 font-medium">Administra, visualiza y descarga tus análises previos.</p>
        </div>

        <button 
          onClick={fetchHistory}
          className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm active:scale-95"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[300px] relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Buscar por ID o mensaje..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-gray-50 border-none rounded-2xl text-sm font-bold px-4 py-3 focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
          >
            <option value="all">Todos los tipos</option>
            <option value="no_response">NO_RESPONSE</option>
            <option value="asr">ASR</option>
            <option value="no_response_validation">Validación</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* History Table */}
        <div className="lg:col-span-2 space-y-4">
          {loading && history.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-20 flex flex-col items-center justify-center text-center space-y-4">
              <RefreshCw className="w-12 h-12 text-blue-200 animate-spin" />
              <p className="text-gray-400 font-bold">Cargando historial...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-20 flex flex-col items-center justify-center text-center space-y-4">
              <div className="p-4 bg-gray-50 rounded-full">
                <Database className="w-12 h-12 text-gray-200" />
              </div>
              <div className="space-y-1">
                <p className="text-gray-900 font-black text-xl">No se encontraron análises</p>
                <p className="text-gray-400 font-medium">Intenta ajustar tus filtros o realiza un nuevo análisis.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((item) => (
                <motion.div
                  layout
                  key={item.job_id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`group bg-white p-5 rounded-3xl border transition-all cursor-pointer ${
                    selectedJob?.job_id === item.job_id 
                      ? 'border-blue-500 ring-4 ring-blue-50 shadow-lg' 
                      : 'border-gray-100 hover:border-blue-200 hover:shadow-md'
                  }`}
                  onClick={() => setSelectedJob(item)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-2xl ${
                        item.analysis_type === 'no_response' ? 'bg-indigo-50 text-indigo-600' :
                        item.analysis_type === 'asr' ? 'bg-blue-50 text-blue-600' :
                        'bg-purple-50 text-purple-600'
                      }`}>
                        {item.analysis_type === 'no_response' ? <AlertCircle className="w-5 h-5" /> :
                         item.analysis_type === 'asr' ? <BarChart2 className="w-5 h-5" /> :
                         <ShieldCheck className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-gray-400 font-bold">#{item.job_id.slice(0, 8)}</span>
                          {getStatusBadge(item.status)}
                        </div>
                        <h3 className="font-black text-gray-900 truncate max-w-[200px] md:max-w-md">
                          {item.analysis_type.toUpperCase()} Analysis
                        </h3>
                        <p className="text-[10px] font-bold text-gray-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {formatDateTime(item.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.job_id);
                        }}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight className={`w-5 h-5 text-gray-300 transition-transform ${selectedJob?.job_id === item.job_id ? 'rotate-90 text-blue-500' : ''}`} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Details Panel */}
        <div className="lg:col-span-1">
          <AnimatePresence mode="wait">
            {selectedJob ? (
              <motion.div
                key={selectedJob.job_id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden sticky top-32"
              >
                <div className="p-8 space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                      <FileJson className="w-6 h-6" />
                    </div>
                    <button 
                      onClick={() => setSelectedJob(null)}
                      className="text-gray-400 hover:text-gray-600 text-xs font-bold uppercase tracking-widest"
                    >
                      Cerrar
                    </button>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl font-black text-gray-900 leading-tight">Detalles del Análisis</h2>
                    <p className="text-sm font-mono text-gray-400 break-all">{selectedJob.job_id}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-2xl space-y-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" /> Fecha
                      </span>
                      <p className="text-sm font-bold text-gray-900">
                        {formatDateTime(selectedJob.created_at)}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl space-y-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Database className="w-3 h-3" /> Tipo
                      </span>
                      <p className="text-sm font-bold text-gray-900 uppercase">
                        {selectedJob.analysis_type}
                      </p>
                    </div>
                  </div>

                  {selectedJob.stats && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Resumen de Resultados</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 bg-blue-50/50 rounded-2xl">
                          <span className="text-sm font-bold text-blue-900">Total Registros</span>
                          <span className="text-lg font-black text-blue-600">
                            {selectedJob.stats.total_registros?.toLocaleString() || 
                             selectedJob.stats.total_cdr_rows?.toLocaleString() || 'N/A'}
                          </span>
                        </div>
                        
                        {selectedJob.analysis_type === 'no_response' && selectedJob.stats.linestate_distribution && (
                          <div className="grid grid-cols-1 gap-2">
                            {Object.entries(selectedJob.stats.linestate_distribution).map(([key, val]: [string, any]) => (
                              <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                <span className="text-xs font-bold text-gray-600">{key}</span>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-mono text-gray-400">{val.count}</span>
                                  <span className="text-sm font-black text-gray-900">{val.percentage}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {selectedJob.analysis_type === 'asr' && (
                          <div className="flex items-center justify-between p-4 bg-indigo-50/50 rounded-2xl">
                            <span className="text-sm font-bold text-indigo-900">ASR Global</span>
                            <span className="text-lg font-black text-indigo-600">{selectedJob.stats.asr_global}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 space-y-3">
                    <button 
                      onClick={() => setShowLogs(true)}
                      className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 active:scale-95"
                    >
                      <Terminal className="w-5 h-5" />
                      Ver Logs del Job
                    </button>

                    {selectedJob.status === 'completed' && (
                      <>
                        <a 
                          href={getDetailedDownloadUrl(selectedJob.job_id)}
                          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
                        >
                          <Download className="w-5 h-5" />
                          Descargar CSV
                        </a>
                        {selectedJob.detailed_result_url && (
                          <a 
                            href={getDetailedDownloadUrl(selectedJob.job_id)}
                            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-blue-600 text-blue-600 rounded-2xl font-bold hover:bg-blue-50 transition-all active:scale-95"
                          >
                            <FileJson className="w-5 h-5" />
                            Detalle Completo
                          </a>
                        )}
                      </>
                    )}
                    
                    {selectedJob.status === 'failed' && (
                      <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Error del Sistema</p>
                        <p className="text-xs font-medium text-red-700">{selectedJob.error || 'Error desconocido'}</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-6 border-2 border-dashed border-gray-200 rounded-[2rem]">
                <div className="p-6 bg-gray-50 rounded-full">
                  <ArrowRight className="w-12 h-12 text-gray-200" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-gray-900">Selecciona un análisis</h3>
                  <p className="text-sm text-gray-400 font-medium leading-relaxed">
                    Haz clic en cualquier elemento de la lista para ver los detalles completos, estadísticas y opciones de descarga.
                  </p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showLogs && selectedJob && (
          <JobLogsModal job={selectedJob} onClose={() => setShowLogs(false)} />
        )}
      </AnimatePresence>
    </div>
  );
};
