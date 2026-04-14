/// <reference types="vite/client" />
import React, { useState } from 'react';
import { 
  Zap,
  ShieldCheck,
  History
} from 'lucide-react';
import { Sidebar, ModuleType } from './components/Sidebar';
import { NoResponseModule } from './modules/NoResponse/NoResponseModule';
import { HistoricalNoResponseModule } from './modules/NoResponse/HistoricalNoResponseModule';
import { ASRModule } from './modules/ASR/AsrModule';
import { NoResponseValidationModule } from './modules/NoResponse/NoResponseValidationModule';
import { MaintenanceModule } from './modules/Maintenance/MaintenanceModule';
import { HistoryModule } from './modules/History/HistoryModule';

const App: React.FC = () => {
  const [activeModule, setActiveModule] = useState<ModuleType>('no_response');
  const [lastEndpoint, setLastEndpoint] = useState<string>('None');
  const [debugInfo, setDebugInfo] = useState<{
    jobId: string | null;
    status: string | null;
    lastError: string | null;
    timestamp: string;
  }>({ jobId: null, status: null, lastError: null, timestamp: new Date().toLocaleTimeString() });

  const log = (prefix: string, message: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    const fullMessage = `[${prefix}] ${message}`;
    console.log(`${timestamp} ${fullMessage}`, data || '');
    setDebugInfo(prev => ({
      ...prev,
      timestamp,
    }));
  };

  const renderModule = () => {
    switch (activeModule) {
      case 'no_response':
        return <NoResponseModule log={log} setLastEndpoint={setLastEndpoint} />;
      case 'historical_no_response':
        return <HistoricalNoResponseModule log={log} />;
      case 'no_response_validation':
        return <NoResponseValidationModule log={log} setLastEndpoint={setLastEndpoint} />;
      case 'asr':
        return <ASRModule log={log} setLastEndpoint={setLastEndpoint} />;
      case 'maintenance':
        return <MaintenanceModule />;
      case 'history':
        return <HistoryModule />;
      default:
        return <NoResponseModule log={log} setLastEndpoint={setLastEndpoint} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-900 font-sans selection:bg-blue-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-2.5 rounded-xl shadow-lg shadow-blue-200">
              <Zap className="w-7 h-7 text-white fill-white/20" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tighter text-gray-900 leading-none">T-ZERO</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-[0.2em] text-blue-600 uppercase">CDR Platform</span>
                <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">v2.4.2</span>
              </div>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-blue-600 cursor-pointer transition-colors">
              <ShieldCheck className="w-4 h-4" />
              Seguridad Enterprise
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-blue-600 cursor-pointer transition-colors">
              <History className="w-4 h-4" />
              Historial
            </div>
          </nav>
        </div>
      </header>

      <div className="flex-1 flex max-w-[1600px] mx-auto w-full">
        {/* Sidebar (Left Side) */}
        <Sidebar activeModule={activeModule} onModuleChange={setActiveModule} />

        {/* Main Content */}
        <main className="flex-1 p-10 overflow-y-auto">
          {renderModule()}
          
          {/* Debug Panel (Moved inside main to be visible) */}
          <div className="mt-20 bg-gray-900 rounded-2xl p-4 font-mono text-[10px] text-green-400 border border-gray-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between mb-2 border-b border-gray-800 pb-2">
              <span className="font-bold text-gray-500 uppercase tracking-widest">Debug Monitor</span>
              <span className="text-gray-600">{debugInfo.timestamp}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">ACTIVE_MODULE:</span>
                <span className="text-blue-400">{activeModule.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ENDPOINT:</span>
                <span className="text-indigo-400">{lastEndpoint}</span>
              </div>
            </div>
          </div>
        </main>
      </div>

      <footer className="bg-white border-t border-gray-200 py-10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3 opacity-50">
            <Zap className="w-5 h-5 text-gray-900" />
            <span className="text-sm font-bold tracking-tighter">T-ZERO TECHNOLOGY</span>
          </div>
          <p className="text-sm text-gray-500">© 2026 T-Zero Technology. Todos los derechos reservados.</p>
          <div className="flex gap-6 text-sm font-medium text-gray-400">
            <a href="#" className="hover:text-blue-600 transition-colors">Documentación</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Soporte</a>
            <a href="#" className="hover:text-blue-600 transition-colors">API</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
