import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Terminal, 
  Download, 
  Search, 
  Filter, 
  Clock, 
  Info, 
  AlertTriangle, 
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import { getLogsDownloadUrl } from '../api/client';
import { JobStatus } from '../types/api';
import { formatTimeOnly } from '../lib/dateUtils';

interface JobLogsModalProps {
  job: JobStatus;
  onClose: () => void;
}

export const JobLogsModal: React.FC<JobLogsModalProps> = ({ job, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());

  const toggleExpand = (index: number) => {
    const newSet = new Set(expandedLogs);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setExpandedLogs(newSet);
  };

  const filteredLogs = (job.logs || []).filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         log.stage.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = filterLevel === 'ALL' || log.level === filterLevel;
    return matchesSearch && matchesLevel;
  });

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'INFO': return <Info className="w-4 h-4 text-blue-500" />;
      case 'WARNING': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'ERROR': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Info className="w-4 h-4 text-gray-400" />;
    }
  };

  const getLevelClass = (level: string) => {
    switch (level) {
      case 'INFO': return 'text-blue-700 bg-blue-50 border-blue-100';
      case 'WARNING': return 'text-yellow-700 bg-yellow-50 border-yellow-100';
      case 'ERROR': return 'text-red-700 bg-red-50 border-red-100';
      default: return 'text-gray-700 bg-gray-50 border-gray-100';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 sm:p-8 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gray-900 text-white rounded-2xl">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">Logs del Sistema</h2>
              <p className="text-sm text-gray-500 font-medium">Job ID: <span className="font-mono text-xs">{job.job_id}</span></p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 sm:px-8 border-b border-gray-50 bg-gray-50/50 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Filtrar logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select 
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="bg-white border border-gray-200 rounded-xl text-sm font-bold px-3 py-2 focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
            >
              <option value="ALL">Todos los niveles</option>
              <option value="INFO">INFO</option>
              <option value="WARNING">WARNING</option>
              <option value="ERROR">ERROR</option>
            </select>
          </div>

          <a 
            href={getLogsDownloadUrl(job.job_id)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 active:scale-95"
          >
            <Download className="w-4 h-4" />
            Descargar Log
          </a>
        </div>

        {/* Logs List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-2 font-mono text-xs">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-4">
              <FileText className="w-12 h-12 text-gray-200" />
              <p className="text-gray-400 font-medium">No se encontraron logs con los filtros actuales.</p>
            </div>
          ) : (
            filteredLogs.map((log, index) => (
              <div 
                key={index}
                className={`p-3 rounded-xl border transition-all ${
                  log.level === 'ERROR' ? 'bg-red-50/30 border-red-100' : 
                  log.level === 'WARNING' ? 'bg-yellow-50/30 border-yellow-100' : 
                  'bg-gray-50/30 border-gray-100'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-0.5">{getLevelIcon(log.level)}</div>
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeOnly(log.timestamp)}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${getLevelClass(log.level)}`}>
                          {log.level}
                        </span>
                        <span className="text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded">
                          {log.stage.toUpperCase()}
                        </span>
                        {log.processed_records !== undefined && log.processed_records !== null && (
                          <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                            {log.processed_records.toLocaleString()} REGISTROS
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 font-medium leading-relaxed break-words">
                        {log.message}
                      </p>
                    </div>
                  </div>
                  
                  {log.details && (
                    <button 
                      onClick={() => toggleExpand(index)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-400"
                    >
                      {expandedLogs.has(index) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                </div>

                <AnimatePresence>
                  {log.details && expandedLogs.has(index) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 p-4 bg-gray-900 text-gray-300 rounded-lg text-[10px] whitespace-pre-wrap border border-gray-800">
                        {log.details}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase tracking-widest px-8">
          <span>Total Logs: {filteredLogs.length}</span>
          <span>Última actualización: {formatTimeOnly(job.last_update)}</span>
        </div>
      </motion.div>
    </div>
  );
};
