import React from 'react';
import { motion } from 'motion/react';
import { Info, Target, Hash, ShieldCheck, Calendar, Database, Search } from 'lucide-react';
import { AnalysisStats } from '../types/api';

interface AnalysisCriteriaProps {
  stats?: AnalysisStats;
}

export const AnalysisCriteria: React.FC<AnalysisCriteriaProps> = ({ stats }) => {
  const criteria = [
    {
      title: 'Categoría Analizada',
      value: 'NO_RESPONSE',
      icon: Target,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      description: 'Segmento de números con fallas de contacto.'
    },
    {
      title: 'Unidad de Análisis',
      value: 'Número Único (E164)',
      icon: Hash,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      description: 'Cada número se cuenta una sola vez.'
    },
    {
      title: 'Campo Principal',
      value: 'status / sip_code',
      icon: Search,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      description: 'Campos del CDR usados para clasificar.'
    },
    {
      title: 'Condición Principal',
      value: 'Al menos un NO_RESPONSE',
      icon: ShieldCheck,
      color: 'text-green-600',
      bg: 'bg-green-50',
      description: 'Si tiene ≥1 registro 404/480 en el periodo.'
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl shadow-blue-900/5"
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-blue-50 rounded-lg">
          <Info className="w-5 h-5 text-blue-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Criterios del Análisis</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {criteria.map((item, index) => (
          <div key={index} className="flex gap-4 p-4 rounded-2xl bg-gray-50/50 border border-gray-100">
            <div className={`p-3 rounded-xl ${item.bg} ${item.color} h-fit`}>
              <item.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{item.title}</p>
              <p className="text-sm font-bold text-gray-900 mb-1">{item.value}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{item.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Database className="w-4 h-4 text-gray-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Universo Analizado</p>
            <p className="text-sm font-bold text-gray-700">
              {stats ? `${stats.total_numeros_unicos.toLocaleString()} Números Únicos` : 'Pendiente de análisis'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Calendar className="w-4 h-4 text-gray-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Período del Análisis</p>
            <p className="text-sm font-bold text-gray-700">
              {stats?.first_date && stats?.last_date 
                ? `${stats.first_date} al ${stats.last_date}` 
                : 'Cargando fechas...'}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
        <p className="text-xs text-blue-800 leading-relaxed">
          <span className="font-bold">Nota Técnica:</span> La clasificación <span className="font-bold">NO_RESPONSE</span> se basa en la identificación de códigos de respuesta SIP (404, 480) que indican fallas de conexión. Un número es clasificado si presenta esta condición al menos una vez, independientemente de otros registros exitosos en el mismo período.
        </p>
      </div>
    </motion.div>
  );
};
