export interface AnalysisStats {
  // NO_RESPONSE fields
  total_registros?: number;
  total_numeros_unicos?: number;
  numeros_excluidos_200?: number;
  numeros_excluidos_404?: number;
  numeros_con_frecuencia_insuficiente?: number;
  numeros_match?: number;
  numeros_no_match?: number;
  numeros_con_no_response?: number;
  numeros_sin_no_response?: number;
  
  // ASR fields
  total_intentos?: number;
  intentos_atendidos?: number;
  intentos_no_atendidos?: number;
  asr_global?: number;
  by_ddd?: any[];
  by_region?: any[];
  by_date?: any[];
  by_hour?: any[];
  by_client?: any[];
  by_route?: any[];

  // Validation fields
  tp_count?: number;
  fp_count?: number;
  precision?: number;
  error_rate?: number;
  total_analizados?: number;
  pct_con_respuesta?: number;

  // Common fields
  filas_invalidas_descartadas: number;
  first_date?: string;
  last_date?: string;
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
