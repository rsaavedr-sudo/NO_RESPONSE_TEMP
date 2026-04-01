import React from 'react';
import { motion } from 'motion/react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface ProgressBarProps {
  percent: number;
  stage: string;
  message: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ percent, stage, message, status }) => {
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  const isProcessing = status === 'processing' || status === 'queued';
  const displayPercent = isCompleted ? 100 : percent;

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isProcessing && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
          {isCompleted && <CheckCircle2 className="w-5 h-5 text-green-500" />}
          {isFailed && <AlertCircle className="w-5 h-5 text-red-500" />}
          <span className="font-medium text-gray-700 capitalize">
            {stage.replace('_', ' ')}
          </span>
        </div>
        <span className="text-sm font-mono text-gray-500">{displayPercent}%</span>
      </div>
      
      <div className="relative h-4 w-full bg-gray-200 rounded-full overflow-hidden">
        <motion.div
          className={`absolute top-0 left-0 h-full ${
            isFailed ? 'bg-red-500' : isCompleted ? 'bg-green-500' : 'bg-blue-500'
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${displayPercent}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      
      <p className="text-sm text-gray-600 italic">
        {message}
      </p>
    </div>
  );
};
