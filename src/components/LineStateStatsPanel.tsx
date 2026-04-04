import React from 'react';
import { motion } from 'motion/react';
import { Users, PhoneOff, HelpCircle, PhoneCall } from 'lucide-react';
import { AnalysisStats } from '../types/api';

interface LineStateStatsPanelProps {
  stats: AnalysisStats;
}

export const LineStateStatsPanel: React.FC<LineStateStatsPanelProps> = ({ stats }) => {
  const items = [
    {
      label: 'Total Números',
      value: stats.total_numeros_analizados?.toLocaleString() || '0',
      icon: Users,
      color: 'bg-blue-50 text-blue-600',
      description: 'Números únicos procesados'
    },
    {
      label: 'Inactiva (0-4s)',
      value: `${stats.inactiva_count?.toLocaleString() || '0'} (${stats.inactiva_pct || 0}%)`,
      icon: PhoneOff,
      color: 'bg-red-50 text-red-600',
      description: 'Duración promedio baja'
    },
    {
      label: 'Indeterminada (5-9s)',
      value: `${stats.indeterminada_count?.toLocaleString() || '0'} (${stats.indeterminada_pct || 0}%)`,
      icon: HelpCircle,
      color: 'bg-amber-50 text-amber-600',
      description: 'Duración promedio media'
    },
    {
      label: 'Activa (10s+)',
      value: `${stats.activa_count?.toLocaleString() || '0'} (${stats.activa_pct || 0}%)`,
      icon: PhoneCall,
      color: 'bg-emerald-50 text-emerald-600',
      description: 'Duración promedio alta'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {items.map((item, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div className={`p-3 rounded-xl ${item.color}`}>
              <item.icon className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{item.label}</p>
            <h4 className="text-2xl font-black text-gray-900 mt-1">{item.value}</h4>
            <p className="text-xs text-gray-400 mt-2">{item.description}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
