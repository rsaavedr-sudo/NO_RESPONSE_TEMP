import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { motion } from 'motion/react';

interface LineStatePieChartProps {
  inactiva: number;
  indeterminada: number;
  activa: number;
}

export const LineStatePieChart: React.FC<LineStatePieChartProps> = ({ inactiva, indeterminada, activa }) => {
  const data = [
    { name: 'Inactiva (0-4s)', value: inactiva, color: '#ef4444' },
    { name: 'Indeterminada (5-9s)', value: indeterminada, color: '#f59e0b' },
    { name: 'Activa (10s+)', value: activa, color: '#10b981' },
  ].filter(d => d.value > 0);

  if (data.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-8 rounded-3xl shadow-xl shadow-blue-900/5 border border-gray-100"
    >
      <h3 className="text-lg font-bold text-gray-900 mb-6">Distribución de LineState</h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
            />
            <Legend verticalAlign="bottom" height={36}/>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};
