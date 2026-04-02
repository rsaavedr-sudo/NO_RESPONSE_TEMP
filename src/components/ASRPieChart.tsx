import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { motion } from 'motion/react';

interface ASRPieChartProps {
  atendidos: number;
  noAtendidos: number;
}

export const ASRPieChart: React.FC<ASRPieChartProps> = ({ atendidos, noAtendidos }) => {
  const total = atendidos + noAtendidos;
  const data = total > 0 ? [
    { name: 'ATENDIDOS (200)', value: atendidos },
    { name: 'NO ATENDIDOS', value: noAtendidos },
  ] : [
    { name: 'SIN DATOS', value: 1 },
  ];

  const COLORS = total > 0 ? ['#22c55e', '#ef4444'] : ['#e5e7eb']; // Green for 200, Red for others

  const pctAtendidos = total > 0 ? ((atendidos / total) * 100).toFixed(1) : "0.0";
  const pctNoAtendidos = total > 0 ? ((noAtendidos / total) * 100).toFixed(1) : "0.0";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full h-[520px] bg-white rounded-3xl p-6 border border-gray-100 shadow-sm relative overflow-hidden"
    >
      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
        Distribución de Intentos (ASR)
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
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            {total > 0 && (
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                formatter={(value: number) => [value.toLocaleString(), 'Intentos']}
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
          <p className="text-[10px] font-bold text-green-500 uppercase">ATENDIDOS</p>
          <p className="text-2xl font-black text-gray-900">{pctAtendidos}%</p>
          <p className="text-xs font-bold text-gray-400">{atendidos.toLocaleString()} casos</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-red-500 uppercase">NO ATENDIDOS</p>
          <p className="text-2xl font-black text-gray-900">{pctNoAtendidos}%</p>
          <p className="text-xs font-bold text-gray-400">{noAtendidos.toLocaleString()} casos</p>
        </div>
      </div>
      
      {total > 0 && (
        <div className="mt-4 text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Total Intentos: <span className="text-gray-900">{total.toLocaleString()}</span>
          </p>
        </div>
      )}
    </motion.div>
  );
};
