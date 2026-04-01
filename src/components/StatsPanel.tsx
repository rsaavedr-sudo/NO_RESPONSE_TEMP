import React from 'react';
import { AnalysisStats } from '../types/api';
import { 
  FileText, 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Hash,
  Filter
} from 'lucide-react';

interface StatsPanelProps {
  stats: AnalysisStats;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats }) => {
  const statItems = [
    { label: 'Total Registros', value: stats.total_registros, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Números Únicos', value: stats.total_numeros_unicos, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Match (NO_RESPONSE_TEMP)', value: stats.numeros_match, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'No Match (OTHER)', value: stats.numeros_no_match, icon: XCircle, color: 'text-gray-600', bg: 'bg-gray-50' },
    { label: 'Excluidos (sip_code 200)', value: stats.numeros_excluidos_200, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Excluidos (pct_404 > 30%)', value: stats.numeros_excluidos_404, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Frecuencia Insuficiente', value: stats.numeros_con_frecuencia_insuficiente, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Filas Inválidas', value: stats.filas_invalidas_descartadas, icon: Hash, color: 'text-red-800', bg: 'bg-red-100' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statItems.map((item, index) => (
        <div key={index} className={`p-4 rounded-xl border border-gray-100 shadow-sm ${item.bg} flex items-start gap-3`}>
          <div className={`p-2 rounded-lg ${item.color} bg-white shadow-sm`}>
            <item.icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{item.label}</p>
            <p className={`text-xl font-bold ${item.color}`}>{item.value.toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
