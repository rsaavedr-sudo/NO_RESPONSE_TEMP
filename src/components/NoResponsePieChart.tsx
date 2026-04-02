import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { motion } from 'motion/react';

interface NoResponsePieChartProps {
  conNoResponse: number;
  sinNoResponse: number;
}

export const NoResponsePieChart: React.FC<NoResponsePieChartProps> = ({ conNoResponse, sinNoResponse }) => {
  const data = [
    { name: 'NO_RESPONSE', value: conNoResponse },
    { name: 'OTROS', value: sinNoResponse },
  ];

  const COLORS = ['#ef4444', '#3b82f6']; // Red for NO_RESPONSE, Blue for OTROS

  const total = conNoResponse + sinNoResponse;
  const pctNoResponse = total > 0 ? ((conNoResponse / total) * 100).toFixed(1) : 0;
  const pctOtros = total > 0 ? ((sinNoResponse / total) * 100).toFixed(1) : 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full h-80 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm"
    >
      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
        Distribución de Números Únicos
      </h3>
      
      <div className="w-full h-64">
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
              animationDuration={1500}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
              formatter={(value: number) => [value.toLocaleString(), 'Números']}
            />
            <Legend verticalAlign="bottom" height={36}/>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-2 text-center">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-red-500 uppercase">NO_RESPONSE</p>
          <p className="text-xl font-black text-gray-900">{pctNoResponse}%</p>
          <p className="text-[10px] text-gray-400">{conNoResponse.toLocaleString()} números</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-blue-500 uppercase">OTROS</p>
          <p className="text-xl font-black text-gray-900">{pctOtros}%</p>
          <p className="text-[10px] text-gray-400">{sinNoResponse.toLocaleString()} números</p>
        </div>
      </div>
    </motion.div>
  );
};
