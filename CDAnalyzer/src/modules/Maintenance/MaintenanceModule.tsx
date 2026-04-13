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
import { 
  getSystemStats, 
  cleanupSystem, 
  cleanupTemp, 
  cleanupUploads, 
  cleanupResults, 
  cleanupAll, 
  SystemStats 
} from '../../api/client';
import { formatDateTime } from '../../lib/dateUtils';

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

  const handleCleanup = async (type: 'module' | 'temp' | 'uploads' | 'results' | 'all', module?: string, keepLatest: boolean = false) => {
    let confirmMsg = '';
    switch (type) {
      case 'module':
        confirmMsg = `¿Estás seguro que deseas limpiar los archivos de ${module}?`;
        break;
      case 'temp':
        confirmMsg = '¿Estás seguro que deseas limpiar todos los archivos temporales (> 2h)?';
        break;
      case 'uploads':
        confirmMsg = '¿Estás seguro que deseas limpiar todos los archivos subidos (> 24h)?';
        break;
      case 'results':
        confirmMsg = '¿Estás seguro que deseas limpiar todos los resultados (> 24h)?';
        break;
      case 'all':
        confirmMsg = '¿Estás seguro que deseas realizar una limpieza total segura del sistema?';
        break;
    }
    
    if (!window.confirm(confirmMsg)) return;

    try {
      setCleaning(true);
      let result;
      switch (type) {
        case 'module': result = await cleanupSystem(module, keepLatest); break;
        case 'temp': result = await cleanupTemp(); break;
        case 'uploads': result = await cleanupUploads(); break;
        case 'results': result = await cleanupResults(); break;
        case 'all': result = await cleanupAll(); break;
      }
      
      if (result) {
        setMessage({ 
          text: `${result.message} Se liberaron ${(result.size_freed_bytes / (1024 * 1024)).toFixed(2)} MB.`, 
          type: 'success' 
        });
      }
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
            <p className="text-4xl font-black text-gray-900">{formatSize(stats?.storage?.total.size_bytes || stats?.total_size_bytes || 0)}</p>
            <p className="text-sm text-gray-400 font-medium">{stats?.storage?.total.files || stats?.total_files} archivos detectados</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-amber-600">
            <Clock className="w-5 h-5" />
            <h3 className="font-bold uppercase tracking-wider text-xs">Último Análisis</h3>
          </div>
          <div className="space-y-1">
            <p className="text-xl font-black text-gray-900">
              {stats?.last_analysis ? formatDateTime(stats.last_analysis) : 'No hay registros'}
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
            <p className="text-4xl font-black text-gray-900">{formatSize((stats?.storage?.temp.size_bytes || 0) + (stats?.storage?.backend_temp.size_bytes || 0))}</p>
            <p className="text-sm text-gray-400 font-medium">Liberable eliminando temporales</p>
          </div>
        </div>
      </div>

      {/* Storage Panel */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center gap-3">
          <Database className="w-5 h-5 text-indigo-600" />
          <h2 className="text-xl font-bold text-gray-900">Panel de Almacenamiento</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { id: 'temp', label: 'temp/', stats: stats?.storage?.temp },
            { id: 'uploads', label: 'uploads/', stats: stats?.storage?.uploads },
            { id: 'backend_temp', label: 'backend/temp/', stats: stats?.storage?.backend_temp },
            { id: 'backend_uploads', label: 'backend/uploads/', stats: stats?.storage?.backend_uploads },
          ].map((dir) => (
            <div key={dir.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{dir.label}</p>
              <p className="text-xl font-black text-gray-900">{formatSize(dir.stats?.size_bytes || 0)}</p>
              <p className="text-xs text-gray-500 font-medium">{dir.stats?.files || 0} archivos</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-gray-900">Limpieza por Categoría</h2>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {[
              { id: 'temp', name: 'Limpiar Temporales', description: 'Borra archivos en temp/ (> 2h)', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
              { id: 'uploads', name: 'Limpiar Uploads', description: 'Borra archivos en uploads/ (> 24h)', icon: RefreshCw, color: 'text-blue-600', bg: 'bg-blue-50' },
              { id: 'results', name: 'Limpiar Resultados', description: 'Borra archivos en results/ (> 24h)', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            ].map(cat => (
              <div key={cat.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all">
                <div className="flex items-center gap-4">
                  <div className={`p-3 ${cat.bg} ${cat.color} rounded-xl`}>
                    <cat.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{cat.name}</h4>
                    <p className="text-xs text-gray-400 font-medium">{cat.description}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleCleanup(cat.id as any)}
                  disabled={cleaning}
                  className="px-4 py-2 bg-gray-50 text-gray-600 rounded-xl text-xs font-bold hover:bg-red-50 hover:text-red-600 transition-all"
                >
                  Ejecutar
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
              <h3 className="text-lg font-bold text-red-900">Limpieza Total Segura</h3>
              <p className="text-sm text-red-700 font-medium">
                Esta acción eliminará todos los archivos temporales, cache y resultados antiguos de todas las carpetas. 
                Solo se conservarán los procesos que estén actualmente en ejecución.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => handleCleanup('all')}
                disabled={cleaning}
                className="flex items-center justify-center gap-3 w-full py-4 bg-red-600 text-white rounded-2xl font-black hover:bg-red-700 transition-all shadow-lg shadow-red-200 active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="w-5 h-5" />
                Limpieza TOTAL Segura
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
