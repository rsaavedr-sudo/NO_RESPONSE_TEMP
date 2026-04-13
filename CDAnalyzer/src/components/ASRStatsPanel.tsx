import React, { useState } from 'react';
import { motion } from 'motion/react';
import { PhoneCall, PhoneIncoming, PhoneMissed, Percent, ChevronDown, ChevronUp } from 'lucide-react';
import { AnalysisStats } from '../types/api';

interface ASRStatsPanelProps {
  stats: AnalysisStats;
}

export const ASRStatsPanel: React.FC<ASRStatsPanelProps> = ({ stats }) => {
  const [selectedDim, setSelectedDim] = useState<'by_ddd' | 'by_region' | 'by_date' | 'by_hour' | 'by_client' | 'by_route' | 'by_operator' | 'by_ddd_operator'>('by_region');

  const summaryCards = [
    {
      title: 'Total Intentos',
      value: stats.total_intentos?.toLocaleString() || '0',
      icon: PhoneCall,
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    {
      title: 'Atendidos (200)',
      value: stats.intentos_atendidos?.toLocaleString() || '0',
      icon: PhoneIncoming,
      color: 'text-green-600',
      bg: 'bg-green-50'
    },
    {
      title: 'No Atendidos',
      value: stats.intentos_no_atendidos?.toLocaleString() || '0',
      icon: PhoneMissed,
      color: 'text-red-600',
      bg: 'bg-red-50'
    },
    {
      title: 'ASR Global',
      value: `${stats.asr_global || 0}%`,
      icon: Percent,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50'
    }
  ];

  const dimensions = [
    { id: 'by_ddd', label: 'DDD' },
    { id: 'by_region', label: 'Región' },
    { id: 'by_operator', label: 'Operadora' },
    { id: 'by_ddd_operator', label: 'DDD + Op' },
    { id: 'by_date', label: 'Fecha' },
    { id: 'by_hour', label: 'Rango Horario' },
    { id: 'by_client', label: 'Cliente' },
    { id: 'by_route', label: 'Ruta' }
  ];

  const currentData = stats[selectedDim] || [];

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryCards.map((card, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm"
          >
            <div className={`p-3 rounded-2xl ${card.bg} ${card.color} w-fit mb-4`}>
              <card.icon className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{card.title}</p>
            <p className="text-2xl font-black text-gray-900">{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Analytical Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-gray-900">Tabla Analítica ASR</h3>
          <div className="flex gap-2 bg-gray-100 p-1 rounded-xl overflow-x-auto">
            {dimensions.map((dim) => (
              <button
                key={dim.id}
                onClick={() => setSelectedDim(dim.id as any)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  selectedDim === dim.id 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {dim.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Categoría</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Total Intentos</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Atendidos</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">No Atendidos</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">ASR %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {currentData.length > 0 ? (
                currentData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{row.category}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right font-mono">{row.total.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-green-600 text-right font-mono">{row.attended.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-red-600 text-right font-mono">{row.not_attended.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        row.asr >= 70 ? 'bg-green-50 text-green-600' :
                        row.asr >= 40 ? 'bg-yellow-50 text-yellow-600' :
                        'bg-red-50 text-red-600'
                      }`}>
                        {row.asr}%
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    No hay datos disponibles para esta dimensión.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
