import React from 'react';
import { motion } from 'motion/react';
import { Target, AlertCircle, CheckCircle2, Percent } from 'lucide-react';
import { AnalysisStats } from '../types/api';

interface ValidationStatsPanelProps {
  stats: AnalysisStats;
}

export const ValidationStatsPanel: React.FC<ValidationStatsPanelProps> = ({ stats }) => {
  const cards = [
    {
      title: 'Precisión del Modelo',
      value: `${stats.precision || 0}%`,
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-50',
      description: 'Porcentaje de aciertos (TP / Total)'
    },
    {
      title: 'Tasa de Error',
      value: `${stats.error_rate || 0}%`,
      icon: AlertCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      description: 'Porcentaje de fallos (FP / Total)'
    },
    {
      title: 'Verdaderos Positivos (TP)',
      value: stats.tp_count?.toLocaleString() || '0',
      icon: Target,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      description: 'Números que realmente NO respondieron'
    },
    {
      title: 'Falsos Positivos (FP)',
      value: stats.fp_count?.toLocaleString() || '0',
      icon: AlertCircle,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      description: 'Números que SÍ tuvieron respuesta'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl ${card.bg} ${card.color} group-hover:scale-110 transition-transform`}>
                <card.icon className="w-6 h-6" />
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-500">{card.title}</p>
                <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">{card.description}</p>
          </motion.div>
        ))}
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <Percent className="w-5 h-5 text-indigo-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Métricas de Calidad</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-sm font-medium text-gray-600">Total Números Analizados</span>
              <span className="text-lg font-bold text-gray-900">{stats.total_analizados?.toLocaleString()}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-indigo-600 h-2 rounded-full" style={{ width: '100%' }}></div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-sm font-medium text-gray-600">% con Respuesta Real (SIP 200)</span>
              <span className="text-lg font-bold text-red-600">{stats.pct_con_respuesta}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-red-500 h-2 rounded-full" style={{ width: `${stats.pct_con_respuesta}%` }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
