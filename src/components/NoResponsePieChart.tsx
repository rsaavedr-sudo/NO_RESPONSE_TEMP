import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { motion } from 'motion/react';

interface NoResponsePieChartProps {
  conNoResponse: number;
  sinNoResponse: number;
}

export const NoResponsePieChart: React.FC<NoResponsePieChartProps> = ({ conNoResponse = 0, sinNoResponse = 0 }) => {
  const safeConNoResponse = Number(conNoResponse) || 0;
  const safeSinNoResponse = Number(sinNoResponse) || 0;
  const total = safeConNoResponse + safeSinNoResponse;
  
  const data = total > 0 ? [
    { name: 'NO_RESPONSE', value: safeConNoResponse },
    { name: 'OTROS', value: safeSinNoResponse },
  ] : [
    { name: 'SIN DATOS', value: 1 },
  ];

  const COLORS = total > 0 ? ['#ef4444', '#3b82f6'] : ['#e5e7eb']; // Red, Blue or Gray for empty

  const pctNoResponse = total > 0 ? ((safeConNoResponse / total) * 100).toFixed(1) : "0.0";
  const pctOtros = total > 0 ? ((safeSinNoResponse / total) * 100).toFixed(1) : "0.0";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full h-[520px] bg-white rounded-3xl p-6 border border-gray-100 shadow-sm relative overflow-hidden"
    >
      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
        Distribución de Números Únicos
      </h3>
      
      <div className="w-full h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={0}
              outerRadius={100} // Increased from 80
              paddingAngle={0}
              dataKey="value"
              animationDuration={1500}
              label={({ name, value, percent }) => `${name}: ${(value || 0).toLocaleString()} (${((percent || 0) * 100).toFixed(1)}%)`}
              labelLine={true}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            {total > 0 && (
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                formatter={(value: number) => [(value || 0).toLocaleString(), 'Números']}
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

      <div className="grid grid-cols-2 gap-4 mt-4 text-center border-t border-gray-50 pt-4">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-red-500 uppercase">NO_RESPONSE</p>
          <p className="text-2xl font-black text-gray-900">{pctNoResponse}%</p>
          <p className="text-xs font-bold text-gray-400">{safeConNoResponse.toLocaleString()} casos</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-blue-500 uppercase">OTROS</p>
          <p className="text-2xl font-black text-gray-900">{pctOtros}%</p>
          <p className="text-xs font-bold text-gray-400">{safeSinNoResponse.toLocaleString()} casos</p>
        </div>
      </div>
      
      {total > 0 && (
        <div className="mt-4 text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Total Universo: <span className="text-gray-900">{total.toLocaleString()} Números Únicos</span>
          </p>
        </div>
      )}
    </motion.div>
  );
};
