import React from 'react';
import { motion } from 'motion/react';
import { Loader2, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

interface ProgressBarProps {
  percent?: number | null;
  stage?: string | null;
  message?: string | null;
  status?: 'queued' | 'processing' | 'completed' | 'failed' | 'stopped' | 'cleaned' | null;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ 
  percent = 0, 
  stage = '', 
  message = '', 
  status = 'queued' 
}) => {
  const safeStatus = status || 'queued';
  const isCompleted = safeStatus === 'completed' || safeStatus === 'cleaned';
  const isFailed = safeStatus === 'failed';
  const isStopped = safeStatus === 'stopped';
  const isProcessing = safeStatus === 'processing' || safeStatus === 'queued';
  
  const safePercent = typeof percent === 'number' ? percent : 0;
  const displayPercent = isCompleted ? 100 : safePercent;

  const statusLabels: Record<string, string> = {
    queued: 'En cola',
    processing: 'Procesando',
    completed: 'Completado',
    failed: 'Error',
    stopped: 'Detenido',
    cleaned: 'Limpiado'
  };

  const safeStage = typeof stage === 'string' ? stage : stage != null ? String(stage) : '';
  const cleanedStage = safeStage.replace(/_/g, ' ');

  const safeMessage = typeof message === 'string' ? message : message != null ? String(message) : '';

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isProcessing && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
          {isCompleted && <CheckCircle2 className="w-5 h-5 text-green-500" />}
          {isFailed && <AlertCircle className="w-5 h-5 text-red-500" />}
          {isStopped && <XCircle className="w-5 h-5 text-orange-500" />}
          <span className="font-bold text-gray-900 uppercase tracking-tight">
            {statusLabels[safeStatus] || safeStatus}
          </span>
          {cleanedStage && (
            <span className="text-xs font-medium text-gray-400 uppercase tracking-widest border-l border-gray-200 pl-2">
              {cleanedStage}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-mono font-bold text-gray-900">{displayPercent}%</span>
        </div>
      </div>
      
      <div className="relative h-4 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-200">
        <motion.div
          className={`absolute top-0 left-0 h-full ${
            isFailed ? 'bg-red-500' : 
            isCompleted ? 'bg-green-500' : 
            isStopped ? 'bg-orange-500' : 
            'bg-blue-600'
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${displayPercent}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      
      {safeMessage && (
        <p className={`text-sm ${isStopped ? 'text-orange-600 font-medium' : isFailed ? 'text-red-600' : 'text-gray-600'}`}>
          {safeMessage}
        </p>
      )}
    </div>
  );
};
