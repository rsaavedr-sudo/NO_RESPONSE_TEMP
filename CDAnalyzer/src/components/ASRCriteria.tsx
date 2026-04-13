import React from 'react';
import { motion } from 'motion/react';
import { Info, Target, Hash, ShieldCheck, Calendar, Database, Search, MapPin } from 'lucide-react';
import { AnalysisStats } from '../types/api';

interface ASRCriteriaProps {
  stats?: AnalysisStats;
}

export const ASRCriteria: React.FC<ASRCriteriaProps> = ({ stats }) => {
  const criteria = [
    {
      title: 'Lógica del ASR',
      value: 'SIP 200 = Atendido',
      icon: Target,
      color: 'text-green-600',
      bg: 'bg-green-50',
      description: 'Cualquier otro código se considera no atendido.'
    },
    {
      title: 'Unidad de Análisis',
      value: 'Cada Intento (Registro)',
      icon: Hash,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      description: 'Se analiza cada fila del CDR de forma individual.'
    },
    {
      title: 'Fórmula ASR',
      value: '(Atendidos / Total) × 100',
      icon: Search,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      description: 'Porcentaje de efectividad de las llamadas.'
    },
    {
      title: 'Extracción DDD',
      value: '3er y 4to dígito (E.164)',
      icon: MapPin,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      description: 'Se extrae el DDD para mapear la región de Brasil.'
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl shadow-blue-900/5 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
        <Info className="w-32 h-32" />
      </div>
      
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-green-50 rounded-lg">
          <Info className="w-5 h-5 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Criterios del Análisis ASR</h2>
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
              {stats ? `${stats.total_intentos?.toLocaleString()} Intentos Totales` : 'Pendiente de análisis'}
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

      <div className="mt-6 p-4 bg-green-50/50 rounded-2xl border border-green-100">
        <p className="text-xs text-green-800 leading-relaxed">
          <span className="font-bold">Nota Técnica:</span> El ASR se calcula sobre el total de intentos de llamada. Se considera un intento atendido únicamente cuando el código de respuesta SIP es exactamente 200. La extracción del DDD permite segmentar el rendimiento por regiones geográficas de Brasil.
        </p>
      </div>
    </motion.div>
  );
};
