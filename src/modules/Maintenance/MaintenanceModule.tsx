import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Settings, 
  Trash2, 
  HardDrive, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw,
  Database,
  Layers,
  Zap
} from 'lucide-react';
import { getSystemStats, cleanupSystem, SystemStats } from '../../api/client';

export const MaintenanceModule: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await getSystemStats();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleCleanup = async (module?: string, keepLatest: boolean = false) => {
    const confirmMsg = module 
      ? `¿Estás seguro que deseas limpiar los archivos de ${module}?`
      : '¿Estás seguro que deseas realizar una limpieza global del sistema?';
    
    if (!window.confirm(confirmMsg)) return;

    try {
      setCleaning(true);
      const result = await cleanupSystem(module, keepLatest);
      setMessage({ 
        text: `${result.message} Se liberaron ${(result.size_freed_bytes / (1024 * 1024)).toFixed(2)} MB.`, 
        type: 'success' 
      });
      await fetchStats();
    } catch (error) {
      setMessage({ text: 'Error al realizar la limpieza.', type: 'error' });
    } finally {
      setCleaning(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200">
            <Settings className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Mantenimiento del Sistema</h1>
            <p className="text-gray-500 font-medium">Gestiona el almacenamiento y libera espacio de forma segura.</p>
          </div>
        </div>
        <button 
          onClick={fetchStats}
          disabled={loading || cleaning}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-indigo-600"
        >
          <RefreshCw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {message && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span className="font-bold">{message.text}</span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-indigo-600">
            <HardDrive className="w-5 h-5" />
            <h3 className="font-bold uppercase tracking-wider text-xs">Almacenamiento Total</h3>
          </div>
          <div className="space-y-1">
            <p className="text-4xl font-black text-gray-900">{formatSize(stats?.total_size_bytes || 0)}</p>
            <p className="text-sm text-gray-400 font-medium">{stats?.total_files} archivos detectados</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-amber-600">
            <Clock className="w-5 h-5" />
            <h3 className="font-bold uppercase tracking-wider text-xs">Último Análisis</h3>
          </div>
          <div className="space-y-1">
            <p className="text-xl font-black text-gray-900">
              {stats?.last_analysis ? new Date(stats.last_analysis).toLocaleString() : 'No hay registros'}
            </p>
            <p className="text-sm text-gray-400 font-medium">Fecha de creación más reciente</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-emerald-600">
            <Zap className="w-5 h-5" />
            <h3 className="font-bold uppercase tracking-wider text-xs">Espacio Potencial</h3>
          </div>
          <div className="space-y-1">
            <p className="text-4xl font-black text-gray-900">{formatSize(stats?.temp_size_bytes || 0)}</p>
            <p className="text-sm text-gray-400 font-medium">Liberable eliminando temporales</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-gray-900">Limpieza por Módulo</h2>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {[
              { id: 'no_response', name: 'Análisis NO_RESPONSE', bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
              { id: 'asr', name: 'Análisis ASR', bgColor: 'bg-purple-50', textColor: 'text-purple-600' },
              { id: 'no_response_validation', name: 'Validación NO_RESPONSE', bgColor: 'bg-indigo-50', textColor: 'text-indigo-600' }
            ].map(module => (
              <div key={module.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all">
                <div className="flex items-center gap-4">
                  <div className={`p-3 ${module.bgColor} ${module.textColor} rounded-xl`}>
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{module.name}</h4>
                    <p className="text-xs text-gray-400 font-medium">
                      {stats?.by_module[module.id]?.files || 0} archivos • {formatSize(stats?.by_module[module.id]?.size || 0)}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => handleCleanup(module.id)}
                  disabled={cleaning}
                  className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  title="Limpiar módulo"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h2 className="text-xl font-bold text-gray-900">Acciones Globales</h2>
          </div>

          <div className="bg-red-50/50 border border-red-100 rounded-3xl p-8 space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-red-900">Limpieza Profunda</h3>
              <p className="text-sm text-red-700 font-medium">
                Esta acción eliminará todos los archivos temporales, cache y resultados antiguos. 
                Solo se conservarán los procesos que estén actualmente en ejecución.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => handleCleanup(undefined, true)}
                disabled={cleaning}
                className="flex items-center justify-center gap-3 w-full py-4 bg-white border-2 border-red-200 text-red-600 rounded-2xl font-black hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                <Clock className="w-5 h-5" />
                Limpiar todo excepto lo último
              </button>

              <button
                onClick={() => handleCleanup()}
                disabled={cleaning}
                className="flex items-center justify-center gap-3 w-full py-4 bg-red-600 text-white rounded-2xl font-black hover:bg-red-700 transition-all shadow-lg shadow-red-200 active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="w-5 h-5" />
                Limpiar TODO el sistema
              </button>
            </div>

            <div className="p-4 bg-white/50 rounded-xl border border-red-100 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-red-600 leading-relaxed font-medium">
                Atención: Los resultados de análisis anteriores no podrán ser descargados después de esta operación. 
                Asegúrate de haber guardado los reportes necesarios.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
