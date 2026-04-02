import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Activity, FileSpreadsheet, BarChart2 } from 'lucide-react';
import { UploadForm } from '../../components/UploadForm';
import { ErrorAlert } from '../../components/ErrorAlert';

interface AsrModuleProps {
  log: (prefix: string, message: string, data?: any) => void;
  setLastEndpoint: (endpoint: string) => void;
}

export const AsrModule: React.FC<AsrModuleProps> = ({ log, setLastEndpoint }) => {
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (files: File[], analysisDays: number, minFrequency: number) => {
    log('asr', 'iniciado', { files: files.length });
    setLastEndpoint(`POST /analyze (ASR)`);
    setError("El módulo ASR Analysis está en desarrollo. Próximamente disponible.");
  };

  return (
    <div className="space-y-10">
      <section className="text-center space-y-4">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl font-black tracking-tight text-gray-900"
        >
          Análisis <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">ASR</span>
        </motion.h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Calcula el Answer Seizure Ratio (ASR) para medir la efectividad de tus rutas y destinos.
        </p>
      </section>

      <ErrorAlert message={error || ''} onClose={() => setError(null)} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5 space-y-8">
          <div className="bg-white p-8 rounded-3xl shadow-xl shadow-indigo-900/5 border border-gray-100">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Configuración ASR</h2>
            </div>
            <UploadForm 
              onAnalyze={handleAnalyze} 
              disabled={false} 
            />
          </div>
        </div>

        <div className="lg:col-span-7 space-y-8">
          <div className="bg-white p-8 rounded-3xl shadow-xl shadow-indigo-900/5 border border-gray-100 min-h-[400px]">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Activity className="w-5 h-5 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Métricas ASR</h2>
            </div>
            
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 space-y-4">
              <BarChart2 className="w-16 h-16 opacity-20" />
              <p className="text-sm font-medium">Módulo en fase de desarrollo.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
