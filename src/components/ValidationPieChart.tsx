import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { motion } from 'motion/react';
import { Target } from 'lucide-react';

interface ValidationPieChartProps {
  tp: number;
  fp: number;
  totalCdr: number;
}

export const ValidationPieChart: React.FC<ValidationPieChartProps> = ({ tp, fp, totalCdr }) => {
  const resto = Math.max(0, totalCdr - (tp + fp));
  const data = [
    { name: 'Aciertos (TP)', value: tp, color: '#10b981' }, // emerald-500
    { name: 'Errores (FP)', value: fp, color: '#ef4444' },  // red-500
    { name: 'Otros registros', value: resto, color: '#94a3b8' } // slate-400
  ];

  if (totalCdr === 0) {
    return (
      <div className="bg-white p-8 rounded-3xl shadow-xl shadow-blue-900/5 border border-gray-100 flex flex-col items-center justify-center h-[400px] text-gray-400">
        <Target className="w-16 h-16 opacity-10 mb-4" />
        <p className="text-lg font-medium">Sin datos para el gráfico</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white p-8 rounded-3xl shadow-xl shadow-blue-900/5 border border-gray-100"
    >
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <Target className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Distribución de Aciertos</h2>
            <p className="text-sm text-gray-500">Impacto del modelo sobre el tráfico total CDR</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total CDR</p>
          <p className="text-2xl font-black text-indigo-600">{totalCdr.toLocaleString()}</p>
        </div>
      </div>

      <div className="h-[300px] w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={80}
              outerRadius={110}
              paddingAngle={2}
              dataKey="value"
              animationDuration={1500}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                borderRadius: '16px', 
                border: 'none', 
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                padding: '12px 16px'
              }}
              formatter={(value: number) => [
                `${value.toLocaleString()} (${((value / totalCdr) * 100).toFixed(2)}%)`,
                'Registros'
              ]}
            />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              iconType="circle"
              formatter={(value, entry: any) => {
                const item = data.find(d => d.name === value);
                const count = item ? item.value : 0;
                const percentage = ((count / totalCdr) * 100).toFixed(2);
                return (
                  <span className="text-sm font-medium text-gray-600">
                    {value}: <span className="font-bold text-gray-900">{count.toLocaleString()}</span> ({percentage}%)
                  </span>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Center label for total */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none mb-8">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Total CDR</p>
          <p className="text-xl font-black text-gray-900 leading-none">{totalCdr.toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
          <div className="flex justify-between items-start mb-1">
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Aciertos (TP)</p>
            <p className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
              {((tp / totalCdr) * 100).toFixed(1)}%
            </p>
          </div>
          <p className="text-xl font-black text-emerald-700">{tp.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
          <div className="flex justify-between items-start mb-1">
            <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Errores (FP)</p>
            <p className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full">
              {((fp / totalCdr) * 100).toFixed(1)}%
            </p>
          </div>
          <p className="text-xl font-black text-red-700">{fp.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="flex justify-between items-start mb-1">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Otros</p>
            <p className="text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-full">
              {((resto / totalCdr) * 100).toFixed(1)}%
            </p>
          </div>
          <p className="text-xl font-black text-slate-700">{resto.toLocaleString()}</p>
        </div>
      </div>
    </motion.div>
  );
};
