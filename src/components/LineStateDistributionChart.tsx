import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { motion } from 'motion/react';

interface LineStateDistributionChartProps {
  distribution?: {
    Active: { count: number; percentage: number };
    Inactive: { count: number; percentage: number };
    Indeterminate: { count: number; percentage: number };
  };
}

export const LineStateDistributionChart: React.FC<LineStateDistributionChartProps> = ({ distribution }) => {
  if (!distribution) {
    return (
      <div className="w-full h-[520px] bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col items-center justify-center text-gray-400">
        <p className="text-lg font-medium">Sin datos de LineState</p>
        <p className="text-sm opacity-60">Asegúrate de que el archivo contiene las columnas 'status' y 'LineState'.</p>
      </div>
    );
  }

  const data = [
    { name: 'Active', value: distribution.Active.count, color: '#10b981', pct: distribution.Active.percentage },
    { name: 'Inactive', value: distribution.Inactive.count, color: '#ef4444', pct: distribution.Inactive.percentage },
    { name: 'Indeterminate', value: distribution.Indeterminate.count, color: '#f59e0b', pct: distribution.Indeterminate.percentage },
  ].filter(d => d.value > 0);

  const total = distribution.Active.count + distribution.Inactive.count + distribution.Indeterminate.count;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full h-[520px] bg-white rounded-3xl p-6 border border-gray-100 shadow-sm relative overflow-hidden"
    >
      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
        Distribución LineState (NO_RESPONSE_TEMP)
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
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
              formatter={(value: number) => [value.toLocaleString(), 'Registros']}
            />
            <Legend verticalAlign="bottom" height={36}/>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4 text-center border-t border-gray-50 pt-4">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Active</p>
          <p className="text-xl font-black text-gray-900">{distribution.Active.percentage}%</p>
          <p className="text-[10px] font-bold text-gray-400">{distribution.Active.count.toLocaleString()} casos</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Inactive</p>
          <p className="text-xl font-black text-gray-900">{distribution.Inactive.percentage}%</p>
          <p className="text-[10px] font-bold text-gray-400">{distribution.Inactive.count.toLocaleString()} casos</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Indeterminate</p>
          <p className="text-xl font-black text-gray-900">{distribution.Indeterminate.percentage}%</p>
          <p className="text-[10px] font-bold text-gray-400">{distribution.Indeterminate.count.toLocaleString()} casos</p>
        </div>
      </div>
      
      <div className="mt-4 text-center">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Total NO_RESPONSE_TEMP: <span className="text-gray-900">{total.toLocaleString()}</span>
        </p>
      </div>
    </motion.div>
  );
};
