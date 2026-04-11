import React from 'react';
import { AlertTriangle, FileText, Calendar, Database, X, CheckCircle2 } from 'lucide-react';
import { DuplicateCheckResult } from '../types/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DuplicateFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  duplicates: DuplicateCheckResult[];
}

export const DuplicateFilesModal: React.FC<DuplicateFilesModalProps> = ({ isOpen, onClose, onConfirm, duplicates }) => {
  if (!isOpen) return null;

  const duplicateItems = duplicates.filter(d => d.is_duplicate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-amber-50 px-6 py-4 flex items-center justify-between border-b border-amber-100">
          <div className="flex items-center text-amber-800 font-semibold">
            <AlertTriangle className="h-6 w-6 mr-2" />
            Archivos ya procesados detectados
          </div>
          <button onClick={onClose} className="text-amber-500 hover:text-amber-700 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-600 mb-6">
            Los siguientes archivos ya han sido procesados anteriormente y sus datos están guardados en la base de datos incremental. 
            <strong> ¿Deseas continuar usando solo el histórico disponible o cancelar para subir archivos nuevos?</strong>
          </p>

          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {duplicateItems.map((dup, index) => (
              <div key={index} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-start">
                  <FileText className="h-5 w-5 text-blue-500 mt-1 mr-3" />
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gray-900 mb-1">{dup.filename}</div>
                    
                    {dup.existing_batch && (
                      <div className="grid grid-cols-2 gap-y-2 mt-3 text-xs text-gray-600">
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1 text-gray-400" />
                          <span className="font-medium mr-1">Período:</span>
                          {dup.existing_batch.period_start ? format(new Date(dup.existing_batch.period_start), 'dd/MM/yyyy') : 'N/A'} - 
                          {dup.existing_batch.period_end ? format(new Date(dup.existing_batch.period_end), 'dd/MM/yyyy') : 'N/A'}
                        </div>
                        <div className="flex items-center">
                          <Database className="h-3 w-3 mr-1 text-gray-400" />
                          <span className="font-medium mr-1">Registros:</span>
                          {dup.existing_batch.total_rows.toLocaleString()}
                        </div>
                        <div className="flex items-center col-span-2">
                          <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                          <span className="font-medium mr-1">Procesado el:</span>
                          {format(new Date(dup.existing_batch.processed_at), "dd 'de' MMMM, yyyy HH:mm", { locale: es })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center"
          >
            Continuar con histórico
          </button>
        </div>
      </div>
    </div>
  );
};
