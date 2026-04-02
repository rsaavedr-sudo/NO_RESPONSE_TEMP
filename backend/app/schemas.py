from pydantic import BaseModel
from typing import Optional, Dict, Any, List

class AnalysisStats(BaseModel):
    # NO_RESPONSE fields
    total_registros: Optional[int] = None
    total_numeros_unicos: Optional[int] = None
    numeros_excluidos_200: Optional[int] = None
    numeros_excluidos_404: Optional[int] = None
    numeros_con_frecuencia_insuficiente: Optional[int] = None
    numeros_match: Optional[int] = None
    numeros_no_match: Optional[int] = None
    numeros_con_no_response: Optional[int] = None
    numeros_sin_no_response: Optional[int] = None
    
    # ASR fields
    total_intentos: Optional[int] = None
    intentos_atendidos: Optional[int] = None
    intentos_no_atendidos: Optional[int] = None
    asr_global: Optional[float] = None
    by_ddd: Optional[List[Dict[str, Any]]] = None
    by_region: Optional[List[Dict[str, Any]]] = None
    by_date: Optional[List[Dict[str, Any]]] = None
    by_hour: Optional[List[Dict[str, Any]]] = None
    by_client: Optional[List[Dict[str, Any]]] = None
    by_route: Optional[List[Dict[str, Any]]] = None

    # Validation fields
    tp_count: Optional[int] = None
    fp_count: Optional[int] = None
    tp_rows: Optional[int] = None
    fp_rows: Optional[int] = None
    total_cdr_rows: Optional[int] = None
    precision: Optional[float] = None
    error_rate: Optional[float] = None
    total_analizados: Optional[int] = None
    pct_con_respuesta: Optional[float] = None

    # Common fields
    filas_invalidas_descartadas: int
    first_date: Optional[str] = None
    last_date: Optional[str] = None
    cdr_stats: Optional[List[Dict[str, Any]]] = None

class JobStatus(BaseModel):
    job_id: str
    status: str
    analysis_type: str = "no_response"
    progress_percent: int
    stage: str
    message: str
    stats: Optional[AnalysisStats] = None
    result_url: Optional[str] = None
    detailed_result_url: Optional[str] = None
    error: Optional[str] = None

class AnalyzeResponse(BaseModel):
    job_id: str
    status: str
    analysis_type: str
