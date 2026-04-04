import React from 'react';
import { Home, BarChart2, Activity, PieChart, Settings, ShieldCheck, Target, Trash2 } from 'lucide-react';

export type ModuleType = 'no_response' | 'asr' | 'no_response_validation' | 'non_respond_linestate' | 'acd' | 'seizure' | 'amd' | 'maintenance';

interface SidebarProps {
  activeModule: ModuleType;
  onModuleChange: (module: ModuleType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeModule, onModuleChange }) => {
  const menuItems = [
    { id: 'no_response' as ModuleType, label: 'NO_RESPONSE Analysis', icon: Home },
    { id: 'no_response_validation' as ModuleType, label: 'NO_RESPONSE Validation', icon: ShieldCheck },
    { id: 'non_respond_linestate' as ModuleType, label: 'NON_RESPOND + LineState', icon: Activity },
    { id: 'asr' as ModuleType, label: 'ASR Analysis', icon: BarChart2 },
    { id: 'acd' as ModuleType, label: 'ACD Analysis', icon: Activity, disabled: true },
    { id: 'seizure' as ModuleType, label: 'Seizure Rate', icon: PieChart, disabled: true },
    { id: 'amd' as ModuleType, label: 'AMD Analysis', icon: Settings, disabled: true },
    { id: 'maintenance' as ModuleType, label: 'System Maintenance', icon: Trash2 },
  ];

  return (
    <aside className="w-72 bg-white border-r border-gray-200 h-[calc(100vh-5rem)] sticky top-20 overflow-y-auto">
      <div className="p-6 space-y-8">
        <div>
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4 px-2">
            Módulos de Análisis
          </h3>
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => !item.disabled && onModuleChange(item.id)}
                  disabled={item.disabled}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-100/50'
                      : item.disabled
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : item.disabled ? 'text-gray-200' : 'text-gray-400'}`} />
                  <span className="truncate">{item.label}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.5)]" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-8 border-t border-gray-100">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 border border-gray-200/50">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Próximamente</p>
            <p className="text-xs text-gray-600 leading-relaxed">
              Estamos desarrollando nuevos algoritmos para ACD y AMD.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};
