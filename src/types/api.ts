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
  
  // LineState fields
  inactiva_count?: number;
  indeterminada_count?: number;
  activa_count?: number;
  inactiva_pct?: number;
  indeterminada_pct?: number;
  activa_pct?: number;

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
  by_operator?: any[];
  by_ddd_operator?: any[];

  // Validation fields
  tp_count?: number;
  fp_count?: number;
  tp_rows?: number;
  fp_rows?: number;
  total_cdr_rows?: number;
  precision?: number;
  error_rate?: number;
  total_analizados?: number;
  pct_con_respuesta?: number;
  tp_line_state?: {
    inactiva: number;
    indeterminada: number;
    activa: number;
  };
  total_line_state?: {
    inactiva: number;
    indeterminada: number;
    activa: number;
  };
  linestate_matches?: number;
  has_target_linestate?: boolean;
  linestate_distribution?: {
    Active: { count: number; percentage: number };
    Inactive: { count: number; percentage: number };
    Indeterminate: { count: number; percentage: number };
  };

  // Common fields
  filas_invalidas_descartadas: number;
  first_date?: string;
  last_date?: string;
  cdr_stats?: any[];
}

export interface JobLog {
  timestamp: string;
  level: 'INFO' | 'WARNING' | 'ERROR';
  stage: string;
  message: string;
  details?: string;
  processed_records?: number;
}

export interface JobStatus {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'stopped' | 'cleaned';
  analysis_type: string;
  progress_percent: number;
  stage: string;
  message: string;
  stats?: AnalysisStats;
  result_url?: string;
  detailed_result_url?: string;
  error?: string;
  logs?: JobLog[];
  last_update?: string;
  created_at: string;
  processed_records?: number;
}

export interface ProcessedBatch {
  id: number;
  batch_name: string;
  source_filename: string;
  file_hash: string;
  period_start?: string;
  period_end?: string;
  total_rows: number;
  processed_at: string;
  notes?: string;
}

export interface DuplicateCheckResult {
  filename: string;
  is_duplicate: boolean;
  existing_batch?: ProcessedBatch;
}

export interface DuplicateCheckResponse {
  results: DuplicateCheckResult[];
  has_duplicates: boolean;
}
