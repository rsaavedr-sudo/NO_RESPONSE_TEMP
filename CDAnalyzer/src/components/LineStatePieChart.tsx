import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { motion } from 'motion/react';

interface LineStatePieChartProps {
  inactiva: number;
  indeterminada: number;
  activa: number;
  title?: string;
}

export const LineStatePieChart: React.FC<LineStatePieChartProps> = ({ inactiva, indeterminada, activa, title }) => {
  const total = inactiva + indeterminada + activa;
  const data = total > 0 ? [
    { name: 'INACTIVA', value: inactiva, color: '#ef4444' },
    { name: 'INDETERMINADA', value: indeterminada, color: '#f59e0b' },
    { name: 'ACTIVA', value: activa, color: '#10b981' },
  ].filter(d => d.value > 0) : [
    { name: 'SIN DATOS', value: 1, color: '#e5e7eb' },
  ];

  const pctInactiva = total > 0 ? ((inactiva / total) * 100).toFixed(1) : "0.0";
  const pctIndeterminada = total > 0 ? ((indeterminada / total) * 100).toFixed(1) : "0.0";
  const pctActiva = total > 0 ? ((activa / total) * 100).toFixed(1) : "0.0";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full h-[520px] bg-white rounded-3xl p-6 border border-gray-100 shadow-sm relative overflow-hidden"
    >
      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
        {title || 'Distribución de LineState (Match)'}
      </h3>
      
      <div className="w-full h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={0}
              outerRadius={100}
              paddingAngle={0}
              dataKey="value"
              animationDuration={1500}
              label={({ name, value, percent }) => `${name}: ${value.toLocaleString()} (${(percent * 100).toFixed(1)}%)`}
              labelLine={true}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            {total > 0 && (
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                formatter={(value: number) => [value.toLocaleString(), 'Números']}
              />
            )}
            <Legend verticalAlign="bottom" height={36}/>
          </PieChart>
        </ResponsiveContainer>
        
        {total === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none pt-10">
            <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">Sin registros</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4 text-center border-t border-gray-50 pt-4">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-red-500 uppercase">INACTIVA</p>
          <p className="text-xl font-black text-gray-900">{pctInactiva}%</p>
          <p className="text-[10px] font-bold text-gray-400">{inactiva.toLocaleString()} casos</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-amber-500 uppercase">INDETERMINADA</p>
          <p className="text-xl font-black text-gray-900">{pctIndeterminada}%</p>
          <p className="text-[10px] font-bold text-gray-400">{indeterminada.toLocaleString()} casos</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-emerald-500 uppercase">ACTIVA</p>
          <p className="text-xl font-black text-gray-900">{pctActiva}%</p>
          <p className="text-[10px] font-bold text-gray-400">{activa.toLocaleString()} casos</p>
        </div>
      </div>
      
      {total > 0 && (
        <div className="mt-4 text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Total Universo LineState: <span className="text-gray-900">{total.toLocaleString()} Números Únicos</span>
          </p>
        </div>
      )}
    </motion.div>
  );
};
