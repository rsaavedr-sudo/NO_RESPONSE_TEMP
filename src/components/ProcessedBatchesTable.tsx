import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Database, Calendar, Hash, FileText, Clock } from 'lucide-react';
import { ProcessedBatch } from '../types/api';

interface ProcessedBatchesTableProps {
  batches: ProcessedBatch[];
  isLoading: boolean;
}

export const ProcessedBatchesTable: React.FC<ProcessedBatchesTableProps> = ({ batches, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-12 text-center border-2 border-dashed border-gray-200">
        <Database className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No hay archivos procesados</h3>
        <p className="text-gray-500 mt-2">Los archivos que subas para análisis incremental aparecerán aquí.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Archivo</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Período</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registros</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Procesado</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hash</th>
          </tr>
        </thead>
        <thead className="bg-gray-50">
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {batches.map((batch) => (
            <tr key={batch.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 text-blue-500 mr-3" />
                  <div className="text-sm font-medium text-gray-900">{batch.source_filename}</div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex flex-col text-xs text-gray-600">
                  <div className="flex items-center mb-1">
                    <Calendar className="h-3 w-3 mr-1" />
                    <span>{batch.period_start ? format(new Date(batch.period_start), 'dd/MM/yyyy') : 'N/A'}</span>
                  </div>
                  <div className="flex items-center">
                    <Calendar className="h-3 w-3 mr-1" />
                    <span>{batch.period_end ? format(new Date(batch.period_end), 'dd/MM/yyyy') : 'N/A'}</span>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                <div className="flex items-center">
                  <Hash className="h-4 w-4 mr-1 text-gray-400" />
                  {batch.total_rows.toLocaleString()}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-1 text-gray-400" />
                  {format(new Date(batch.processed_at), "dd MMM yyyy HH:mm", { locale: es })}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-400">
                {batch.file_hash.substring(0, 8)}...
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
