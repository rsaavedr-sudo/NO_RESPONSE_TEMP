export interface AnalysisStats {
  total_registros: number;
  total_numeros_unicos: number;
  numeros_excluidos_200: number;
  numeros_excluidos_404: number;
  numeros_con_frecuencia_insuficiente: number;
  numeros_match: number;
  numeros_no_match: number;
  filas_invalidas_descartadas: number;
}

export interface JobStatus {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'stopped';
  analysis_type: string;
  progress_percent: number;
  stage: string;
  message: string;
  stats?: AnalysisStats;
  result_url?: string;
  error?: string;
}
