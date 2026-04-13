import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Database, BarChart3, Download, Calendar, Filter, CheckCircle2, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { runHistoricalAnalysis, getHistoricalAnalysisHistory, getHistoricalDownloadUrl } from '../../api/client';
import { NoResponsePieChart } from '../../components/NoResponsePieChart';

interface HistoricalNoResponseModuleProps {
  log: (prefix: string, message: string, data?: any) => void;
}

export const HistoricalNoResponseModule: React.FC<HistoricalNoResponseModuleProps> = ({ log }) => {
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [maxSip200, setMaxSip200] = useState(0);
  const [selectedSipCodes, setSelectedSipCodes] = useState<number[]>([404, 480, 486, 487, 500, 503, 603]);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'analysis' | 'history'>('analysis');

  const sipOptions = [
    { code: 404, label: '404 Not Found' },
    { code: 480, label: '480 Temp Unavailable' },
    { code: 486, label: '486 Busy Here' },
    { code: 487, label: '487 Request Terminated' },
    { code: 500, label: '500 Server Internal Error' },
    { code: 503, label: '503 Service Unavailable' },
    { code: 603, label: '603 Decline' }
  ];

  const fetchHistory = async () => {
    try {
      const data = await getHistoricalAnalysisHistory();
      setHistory(data);
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const handleToggleSip = (code: number) => {
    setSelectedSipCodes(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleRunAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    log('HISTORICAL', 'Iniciando análisis histórico', { startDate, endDate, maxSip200, selectedSipCodes });
    
    try {
      const data = await runHistoricalAnalysis({
        start_date: startDate,
        end_date: endDate,
        max_sip_200: maxSip200,
        selected_sip_codes: selectedSipCodes
      });
      setResults(data);
      log('HISTORICAL', 'Análisis completado', data.stats);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Error desconocido';
      setError(msg);
      log('HISTORICAL', 'Error en análisis', { error: msg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-6 h-6 text-indigo-600" />
            Análisis Histórico NO_RESPONSE
          </h2>
          <p className="text-slate-500 mt-1">Analiza datos existentes en la base sin cargar nuevos archivos.</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('analysis')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'analysis' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Nuevo Análisis
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Historial
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'analysis' ? (
          <motion.div
            key="analysis"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Configuration Card */}
              <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Configuración
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Rango de Fechas</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Máximo SIP 200 (Minimum Response)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={maxSip200}
                      onChange={(e) => setMaxSip200(parseInt(e.target.value) || 0)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      0 = Solo NO_RESPONSE puro. {'>'}0 incluye números con pocas respuestas.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Causas SIP a considerar</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto p-2 border border-slate-100 rounded-lg">
                      {sipOptions.map(opt => (
                        <label key={opt.code} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedSipCodes.includes(opt.code)}
                            onChange={() => handleToggleSip(opt.code)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-slate-600">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleRunAnalysis}
                  disabled={isLoading || selectedSipCodes.length === 0}
                  className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                    isLoading 
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analizando...
                    </>
                  ) : (
                    <>
                      <BarChart3 className="w-5 h-5" />
                      Ejecutar Análisis
                    </>
                  )}
                </button>
              </div>

              {/* Results Area */}
              <div className="lg:col-span-2 space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 text-red-700">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium">{error}</p>
                  </div>
                )}

                {!results && !isLoading && !error && (
                  <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl h-64 flex flex-col items-center justify-center text-slate-400">
                    <Database className="w-12 h-12 mb-3 opacity-20" />
                    <p>Configure los parámetros y ejecute el análisis para ver resultados.</p>
                  </div>
                )}

                {results && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-6"
                  >
                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Números</p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">{results.stats.total_numbers}</p>
                      </div>
                      <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 shadow-sm">
                        <p className="text-xs font-medium text-indigo-600 uppercase tracking-wider">NO_RESPONSE</p>
                        <p className="text-2xl font-bold text-indigo-900 mt-1">{results.stats.no_response_count}</p>
                      </div>
                      <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 shadow-sm">
                        <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">MINIMUM_RESPONSE</p>
                        <p className="text-2xl font-bold text-amber-900 mt-1">{results.stats.minimum_response_count}</p>
                      </div>
                    </div>

                    {/* Charts & Actions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-indigo-600" />
                          Distribución de Resultados
                        </h4>
                        <div className="h-48">
                          <NoResponsePieChart 
                            matchCount={results.stats.no_response_count} 
                            noMatchCount={results.stats.total_numbers - results.stats.no_response_count} 
                          />
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center space-y-4">
                        <h4 className="font-semibold text-slate-900 mb-2">Descargar Resultados</h4>
                        
                        <a
                          href={getHistoricalDownloadUrl(results.run_id, 'no_response')}
                          className="flex items-center justify-between p-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <Download className="w-5 h-5" />
                            <span className="font-medium">Detalle NO_RESPONSE (CSV)</span>
                          </div>
                          <CheckCircle2 className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>

                        <a
                          href={getHistoricalDownloadUrl(results.run_id, 'minimum_response')}
                          className="flex items-center justify-between p-3 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <Download className="w-5 h-5" />
                            <span className="font-medium">Detalle MINIMUM_RESPONSE (CSV)</span>
                          </div>
                          <CheckCircle2 className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      </div>
                    </div>

                    {/* Preview Tables */}
                    <div className="space-y-4">
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                          <h4 className="font-semibold text-slate-900">Vista Previa: NO_RESPONSE (Top 100)</h4>
                          <span className="text-xs text-slate-500">Mostrando {results.no_response.length} registros</span>
                        </div>
                        <div className="overflow-x-auto max-h-96">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-600 sticky top-0">
                              <tr>
                                <th className="px-4 py-2 font-medium">Número</th>
                                <th className="px-4 py-2 font-medium">Intentos</th>
                                <th className="px-4 py-2 font-medium">SIP 200</th>
                                <th className="px-4 py-2 font-medium">Primera Obs.</th>
                                <th className="px-4 py-2 font-medium">Última Obs.</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {results.no_response.map((item: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="px-4 py-2 font-mono">{item.e164}</td>
                                  <td className="px-4 py-2">{item.intentos}</td>
                                  <td className="px-4 py-2 text-red-600 font-medium">{item.sip_200}</td>
                                  <td className="px-4 py-2 text-slate-500">{item.first_date}</td>
                                  <td className="px-4 py-2 text-slate-500">{item.last_date}</td>
                                </tr>
                              ))}
                              {results.no_response.length === 0 && (
                                <tr>
                                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">No se encontraron registros.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-6 py-4 font-medium">Fecha Ejecución</th>
                    <th className="px-6 py-4 font-medium">Periodo Analizado</th>
                    <th className="px-6 py-4 font-medium">Parámetros</th>
                    <th className="px-6 py-4 font-medium">Resultados</th>
                    <th className="px-6 py-4 font-medium text-right">Descargas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((run) => {
                    const summary = JSON.parse(run.result_summary || '{}');
                    return (
                      <tr key={run.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-900">
                              {new Date(run.created_at).toLocaleDateString()}
                            </span>
                            <span className="text-xs text-slate-500">
                              {new Date(run.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-slate-600">
                            <Calendar className="w-3 h-3" />
                            <span>{run.start_date} al {run.end_date}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600 w-fit">
                              Max SIP 200: {run.max_sip_200}
                            </span>
                            <span className="text-xs text-slate-500 truncate max-w-[150px]">
                              SIP: {JSON.parse(run.selected_sip_codes || '[]').join(', ')}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-3">
                            <div className="flex flex-col">
                              <span className="text-xs text-slate-500">NO_RESPONSE</span>
                              <span className="font-bold text-indigo-600">{summary.stats?.no_response_count || 0}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs text-slate-500">MIN_RESP</span>
                              <span className="font-bold text-amber-600">{summary.stats?.minimum_response_count || 0}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <a
                              href={getHistoricalDownloadUrl(run.id, 'no_response')}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Descargar NO_RESPONSE"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                            <a
                              href={getHistoricalDownloadUrl(run.id, 'minimum_response')}
                              className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Descargar MINIMUM_RESPONSE"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                        No hay análisis históricos registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
