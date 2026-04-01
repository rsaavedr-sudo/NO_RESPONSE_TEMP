import React, { useState, useRef } from 'react';
import { Upload, FileText, X, Settings, Calendar, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UploadFormProps {
  onAnalyze: (file: File, analysisDays: number, minFrequency: number) => void;
  disabled?: boolean;
}

export const UploadForm: React.FC<UploadFormProps> = ({ onAnalyze, disabled }) => {
  const [file, setFile] = useState<File | null>(null);
  const [analysisDays, setAnalysisDays] = useState(7);
  const [minFrequency, setMinFrequency] = useState(5);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      setFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (file) {
      onAnalyze(file, analysisDays, minFrequency);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div
        className={`relative border-2 border-dashed rounded-2xl p-10 transition-all duration-300 flex flex-col items-center justify-center gap-4 cursor-pointer ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".csv"
          className="hidden"
          disabled={disabled}
        />
        
        <AnimatePresence mode="wait">
          {!file ? (
            <motion.div
              key="no-file"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center gap-2"
            >
              <div className="p-4 bg-blue-100 rounded-full text-blue-600">
                <Upload className="w-8 h-8" />
              </div>
              <p className="text-lg font-medium text-gray-700">Arrastra tu archivo CSV aquí</p>
              <p className="text-sm text-gray-500">O haz clic para seleccionar (Máx. 40M+ filas)</p>
            </motion.div>
          ) : (
            <motion.div
              key="file-selected"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-3 bg-green-100 rounded-lg text-green-600">
                <FileText className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Calendar className="w-4 h-4 text-blue-500" />
            Días de Análisis
          </label>
          <input
            type="number"
            value={analysisDays}
            onChange={(e) => setAnalysisDays(parseInt(e.target.value) || 1)}
            min="1"
            max="365"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            disabled={disabled}
          />
          <p className="text-xs text-gray-500">Ventana temporal desde la última fecha del archivo.</p>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Hash className="w-4 h-4 text-blue-500" />
            Frecuencia Mínima
          </label>
          <input
            type="number"
            value={minFrequency}
            onChange={(e) => setMinFrequency(parseInt(e.target.value) || 1)}
            min="1"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            disabled={disabled}
          />
          <p className="text-xs text-gray-500">Mínimo de llamadas por número para clasificar.</p>
        </div>
      </div>

      <button
        type="submit"
        disabled={!file || disabled}
        className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-[0.98] ${
          !file || disabled
            ? 'bg-gray-400 cursor-not-allowed shadow-none'
            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl'
        }`}
      >
        Iniciar Análisis Masivo
      </button>
    </form>
  );
};
