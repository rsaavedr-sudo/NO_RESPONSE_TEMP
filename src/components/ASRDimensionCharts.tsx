import React, { useState } from 'react';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { AnalysisStats } from '../types/api';

interface ASRDimensionChartsProps {
  stats: AnalysisStats;
}

export const ASRDimensionCharts: React.FC<ASRDimensionChartsProps> = ({ stats }) => {
  const [selectedDim, setSelectedDim] = useState<'by_ddd' | 'by_region' | 'by_date' | 'by_hour' | 'by_client' | 'by_route' | 'by_operator' | 'by_ddd_operator'>('by_region');

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

  const currentData = (stats[selectedDim] || []).slice(0, 15); // Limit to top 15 for clarity

  const isTimeBased = selectedDim === 'by_date' || selectedDim === 'by_hour';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h3 className="text-lg font-bold text-gray-900">Visualización por Dimensión</h3>
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

      <div className="w-full h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          {isTimeBased ? (
            <LineChart data={currentData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis 
                dataKey="category" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#9ca3af' }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                yId="left"
              />
              <YAxis 
                orientation="right"
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                yId="right"
                domain={[0, 100]}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
              />
              <Legend verticalAlign="top" height={36}/>
              <Line 
                yId="left"
                type="monotone" 
                dataKey="total" 
                name="Total Intentos" 
                stroke="#3b82f6" 
                strokeWidth={3} 
                dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
              <Line 
                yId="right"
                type="monotone" 
                dataKey="asr" 
                name="ASR %" 
                stroke="#10b981" 
                strokeWidth={3} 
                dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          ) : (
            <BarChart data={currentData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis 
                dataKey="category" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#9ca3af' }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#9ca3af' }}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                cursor={{ fill: '#f9fafb' }}
              />
              <Legend verticalAlign="top" height={36}/>
              <Bar 
                dataKey="attended" 
                name="Atendidos" 
                fill="#10b981" 
                radius={[4, 4, 0, 0]} 
                barSize={20}
              />
              <Bar 
                dataKey="not_attended" 
                name="No Atendidos" 
                fill="#ef4444" 
                radius={[4, 4, 0, 0]} 
                barSize={20}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};
