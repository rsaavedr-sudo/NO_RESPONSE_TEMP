export interface CDRRecord {
  call_date: string;
  call_start: string;
  call_end: string;
  ani: string;
  dni: string;
  e164: string;
  callid: string;
  client_code: string;
  route_code: string;
  sip_code: string;
  tot_secs: string;
  duration: string;
  duration_us: string;
  bill_dur: string;
  bill_val: string;
}

export interface AnalysisResult {
  total_registros: number;
  total_numeros_unicos: number;
  numeros_excluidos_200: number;
  numeros_excluidos_404: number;
  numeros_con_frecuencia_insuficiente: number;
  numeros_analizados: number;
  numeros_match: number;
  numeros_no_match: number;
  discarded_rows: number;
  output_data: { e164: string; frequency: number; pct_404: number; status: string }[];
}
