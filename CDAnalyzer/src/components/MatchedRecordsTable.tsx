import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Table, Download, Search, Filter, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { getPreview, getDetailedDownloadUrl } from '../api/client';

interface MatchedRecordsTableProps {
  jobId: string;
}

export const MatchedRecordsTable: React.FC<MatchedRecordsTableProps> = ({ jobId }) => {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'TP' | 'FP'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        setLoading(true);
        const data = await getPreview(jobId, 'detailed', 500); // Fetch more for local filtering
        setRecords(data);
      } catch (err) {
        console.error('Error fetching preview:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPreview();
  }, [jobId]);

  const filteredRecords = records.filter(record => {
    const matchesSearch = Object.values(record).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchesFilter = filterType === 'ALL' || record.classification_result === filterType;
    return matchesSearch && matchesFilter;
  });

  const totalPages = Math.ceil(filteredRecords.length / pageSize);
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const columns = records.length > 0 ? Object.keys(records[0]) : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl shadow-xl shadow-indigo-900/5 border border-gray-100 overflow-hidden"
    >
      <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Registros Coincidentes del CDR</h2>
            <p className="text-sm text-gray-500">Detalle de registros que hicieron match con NO_RESPONSE</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <a
            href={getDetailedDownloadUrl(jobId)}
            download
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            <Download className="w-4 h-4" />
            Exportar Detalle
          </a>
        </div>
      </div>

      <div className="p-6 bg-gray-50/50 border-b border-gray-100 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar en registros..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="bg-white border border-gray-200 rounded-xl text-sm px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-gray-700"
          >
            <option value="ALL">Todos los Resultados</option>
            <option value="TP">Solo TP (Aciertos)</option>
            <option value="FP">Solo FP (Errores)</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50">
              {columns.map(col => (
                <th key={col} className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  {col.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {columns.length > 0 ? columns.map(c => (
                    <td key={c} className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-full"></div></td>
                  )) : (
                    <td colSpan={5} className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-full"></div></td>
                  )}
                </tr>
              ))
            ) : paginatedRecords.length > 0 ? (
              paginatedRecords.map((record, i) => (
                <tr key={i} className="hover:bg-gray-50/50 transition-colors group">
                  {columns.map(col => (
                    <td key={col} className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                      {col === 'classification_result' ? (
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                          record[col] === 'TP' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {record[col]}
                        </span>
                      ) : col === 'has_sip_200' ? (
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                          record[col] === 'YES' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {record[col]}
                        </span>
                      ) : (
                        record[col]
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length || 1} className="px-6 py-12 text-center text-gray-400 italic">
                  No se encontraron registros que coincidan con los filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="p-6 border-t border-gray-100 flex items-center justify-between bg-gray-50/30">
          <p className="text-sm text-gray-500 font-medium">
            Mostrando <span className="text-gray-900">{(currentPage - 1) * pageSize + 1}</span> a <span className="text-gray-900">{Math.min(currentPage * pageSize, filteredRecords.length)}</span> de <span className="text-gray-900">{filteredRecords.length}</span> registros (Vista previa)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 hover:bg-white border border-gray-200 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                      currentPage === pageNum 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                        : 'hover:bg-white border border-transparent hover:border-gray-200 text-gray-500'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              {totalPages > 5 && <span className="px-2 text-gray-400">...</span>}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 hover:bg-white border border-gray-200 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};
