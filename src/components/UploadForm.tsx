import React, { useState, useRef } from 'react';
import { Upload, FileText, X, Settings, Calendar, Hash, Target, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UploadFormProps {
  onAnalyze: (
    files: File[], 
    analysisDays: number, 
    minFrequency: number, 
    minTotalFrequency?: number, 
    minAvgDailyFrequency?: number
  ) => void;
  onCancel?: () => void;
  disabled?: boolean;
  hideMinFrequency?: boolean;
  hideCriteria?: boolean;
  isValidationMode?: boolean;
}

export const UploadForm: React.FC<UploadFormProps> = ({ 
  onAnalyze, 
  onCancel, 
  disabled, 
  hideMinFrequency,
  hideCriteria,
  isValidationMode 
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [analysisDays, setAnalysisDays] = useState(7);
  const [minFrequency, setMinFrequency] = useState(5);
  const [minTotalFrequency, setMinTotalFrequency] = useState(30);
  const [minAvgDailyFrequency, setMinAvgDailyFrequency] = useState(5);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const csvFiles = Array.from(newFiles).filter(f => f.name.endsWith('.csv'));
    setFiles(prev => [...prev, ...csvFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    if (e.target) e.target.value = '';
  };

  const handleTargetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setTargetFile(e.target.files[0]);
    }
    if (e.target) e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValidationMode) {
      if (targetFile && files.length > 0) {
        onAnalyze(
          [targetFile, ...files], 
          analysisDays, 
          minFrequency, 
          minTotalFrequency, 
          minAvgDailyFrequency
        );
      }
    } else if (files.length > 0) {
      onAnalyze(files, analysisDays, minFrequency);
    }
  };

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {isValidationMode && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-bold text-gray-700 uppercase tracking-wider">
            <Target className="w-4 h-4 text-indigo-600" />
            1. Lista de Números a Validar (Target)
          </label>
          <div 
            onClick={() => !disabled && targetInputRef.current?.click()}
            className={`p-4 border-2 border-dashed rounded-xl transition-all cursor-pointer flex items-center gap-4 ${
              targetFile ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input
              type="file"
              ref={targetInputRef}
              onChange={handleTargetChange}
              accept=".csv"
              className="hidden"
              disabled={disabled}
            />
            <div className={`p-2 rounded-lg ${targetFile ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {targetFile ? targetFile.name : 'Seleccionar archivo de objetivos...'}
              </p>
              <p className="text-[10px] text-gray-500">
                {targetFile ? `${(targetFile.size / 1024).toFixed(1)} KB` : 'Archivo CSV con columna e164'}
              </p>
            </div>
            {targetFile && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setTargetFile(null);
                }}
                className="p-1 hover:bg-red-100 rounded-full text-red-500"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {isValidationMode && (
          <label className="flex items-center gap-2 text-sm font-bold text-gray-700 uppercase tracking-wider">
            <FileText className="w-4 h-4 text-blue-600" />
            2. Archivos CDR para Validación
          </label>
        )}
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
            multiple
            className="hidden"
            disabled={disabled}
          />
          
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="p-4 bg-blue-100 rounded-full text-blue-600">
              <Upload className="w-8 h-8" />
            </div>
            <p className="text-lg font-medium text-gray-700">
              {isValidationMode ? 'Arrastra los CDR aquí' : 'Arrastra tus archivos CSV aquí'}
            </p>
            <p className="text-sm text-gray-500">Puedes subir varios archivos para un análisis consolidado.</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            <div className="flex justify-between items-center px-2">
              <span className="text-sm font-bold text-gray-600 uppercase tracking-wider">
                Archivos cargados ({files.length})
              </span>
              <span className="text-xs font-mono text-gray-400">
                Total: {(totalSize / (1024 * 1024)).toFixed(2)} MB
              </span>
            </div>
            
            <div className="max-h-60 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
              {files.map((f, i) => (
                <motion.div
                  key={`${f.name}-${i}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-4 p-3 bg-white rounded-xl border border-gray-100 shadow-sm group"
                >
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-500">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{f.name}</p>
                    <p className="text-[10px] text-gray-400">{(f.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(i);
                    }}
                    disabled={disabled}
                    className="p-1.5 hover:bg-red-50 rounded-full text-gray-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!hideCriteria && (
        <div className={`grid grid-cols-1 ${isValidationMode ? 'md:grid-cols-3' : hideMinFrequency ? '' : 'md:grid-cols-2'} gap-6`}>
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
            <p className="text-xs text-gray-500">Ventana temporal desde la última fecha.</p>
          </div>

          {isValidationMode ? (
            <>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Hash className="w-4 h-4 text-indigo-500" />
                  Min Frequency
                </label>
                <input
                  type="number"
                  value={minTotalFrequency}
                  onChange={(e) => setMinTotalFrequency(parseInt(e.target.value) || 1)}
                  min="1"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  disabled={disabled}
                />
                <p className="text-xs text-gray-500">Frecuencia total mínima.</p>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Activity className="w-4 h-4 text-purple-500" />
                  Avg Daily Freq
                </label>
                <input
                  type="number"
                  value={minAvgDailyFrequency}
                  onChange={(e) => setMinAvgDailyFrequency(parseFloat(e.target.value) || 0.1)}
                  min="0.1"
                  step="0.1"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                  disabled={disabled}
                />
                <p className="text-xs text-gray-500">Promedio diario mínimo.</p>
              </div>
            </>
          ) : !hideMinFrequency && (
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
              <p className="text-xs text-gray-500">Mínimo de llamadas por número.</p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={files.length === 0 || disabled}
          className={`flex-1 py-4 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-[0.98] ${
            files.length === 0 || disabled
              ? 'bg-gray-400 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl'
          }`}
        >
          Iniciar Análisis Consolidado
        </button>
        
        <button
          type="button"
          onClick={onCancel}
          disabled={!disabled}
          className={`px-6 py-4 rounded-xl font-bold transition-all transform active:scale-[0.98] border-2 flex items-center gap-2 ${
            !disabled
              ? 'border-gray-200 text-gray-300 cursor-not-allowed'
              : 'border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 shadow-md'
          }`}
        >
          <X className="w-5 h-5" />
          Parar
        </button>
      </div>
    </form>
  );
};
