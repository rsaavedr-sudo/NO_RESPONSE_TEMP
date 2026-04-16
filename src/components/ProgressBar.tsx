import React from 'react';
import { motion } from 'motion/react';
import { Loader2, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

interface ProgressBarProps {
  percent: number;
  stage: string;
  message: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'stopped' | 'cleaned';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ percent, stage, message, status }) => {
  const isCompleted = status === 'completed' || status === 'cleaned';
  const isFailed = status === 'failed';
  const isStopped = status === 'stopped';
  const isProcessing = status === 'processing' || status === 'queued';
  const displayPercent = isCompleted ? 100 : percent;

  const statusLabels = {
    queued: 'En cola',
    processing: 'Procesando',
    completed: 'Completado',
    failed: 'Error',
    stopped: 'Detenido',
    cleaned: 'Limpiado'
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isProcessing && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
          {isCompleted && <CheckCircle2 className="w-5 h-5 text-green-500" />}
          {isFailed && <AlertCircle className="w-5 h-5 text-red-500" />}
          {isStopped && <XCircle className="w-5 h-5 text-orange-500" />}
          <span className="font-bold text-gray-900 uppercase tracking-tight">
            {statusLabels[status]}
          </span>
          <span className="text-xs font-medium text-gray-400 uppercase tracking-widest border-l border-gray-200 pl-2">
            {stage.replace('_', ' ')}
          </span>
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
      
      <p className={`text-sm ${isStopped ? 'text-orange-600 font-medium' : isFailed ? 'text-red-600' : 'text-gray-600'}`}>
        {message}
      </p>
    </div>
  );
};
