from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime

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
    by_operator: Optional[List[Dict[str, Any]]] = None
    by_ddd_operator: Optional[List[Dict[str, Any]]] = None

    # Validation fields
    tp_count: Optional[int] = None
    fp_count: Optional[int] = None
    tp_rows: Optional[int] = None
    fp_rows: Optional[int] = None
    total_cdr_rows: Optional[int] = None
    original_target_count: Optional[int] = None
    filtered_target_count: Optional[int] = None
    reduction_pct: Optional[float] = None
    precision: Optional[float] = None
    error_rate: Optional[float] = None
    total_analizados: Optional[int] = None
    pct_con_respuesta: Optional[float] = None
    tp_line_state: Optional[Dict[str, int]] = None
    linestate_distribution: Optional[Dict[str, Any]] = None

    # LineState fields
    inactiva_count: Optional[int] = None
    indeterminada_count: Optional[int] = None
    activa_count: Optional[int] = None
    inactiva_pct: Optional[float] = None
    indeterminada_pct: Optional[float] = None
    activa_pct: Optional[float] = None
    
    # Common fields
    filas_invalidas_descartadas: Optional[int] = 0
    first_date: Optional[str] = None
    last_date: Optional[str] = None
    cdr_stats: Optional[List[Dict[str, Any]]] = None

class JobLog(BaseModel):
    timestamp: datetime
    level: str  # INFO, WARNING, ERROR
    stage: str
    message: str
    details: Optional[str] = None

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
    processed_records: Optional[int] = None
    use_history: bool = True
    history_days: int = 30
    files_skipped: List[str] = []
    days_considered: List[str] = []
    logs: List[JobLog] = []
    last_update: datetime
    created_at: datetime
    completed_at: Optional[datetime] = None

class AnalyzeResponse(BaseModel):
    job_id: str
    status: str
    analysis_type: str

class DirectoryStats(BaseModel):
    files: int
    size_bytes: int

class StorageStats(BaseModel):
    temp: DirectoryStats
    uploads: DirectoryStats
    backend_temp: DirectoryStats
    backend_uploads: DirectoryStats
    results: DirectoryStats
    total: DirectoryStats

class SystemStats(BaseModel):
    total_files: int
    total_size_bytes: int
    temp_files: int
    temp_size_bytes: int
    result_files: int
    result_size_bytes: int
    last_analysis: Optional[datetime] = None
    by_module: Dict[str, Dict[str, Any]]
    storage: Optional[StorageStats] = None

class CleanupRequest(BaseModel):
    module: Optional[str] = None
    keep_latest: bool = False

class CleanupResponse(BaseModel):
    files_deleted: int
    size_freed_bytes: int
    remaining_size_bytes: Optional[Dict[str, int]] = None
    message: str

class ProcessedBatch(BaseModel):
    id: int
    batch_name: str
    source_filename: str
    file_hash: str
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    total_rows: int
    processed_at: datetime
    notes: Optional[str] = None

class DuplicateCheckResult(BaseModel):
    filename: str
    is_duplicate: bool
    existing_batch: Optional[ProcessedBatch] = None

class DuplicateCheckResponse(BaseModel):
    results: List[DuplicateCheckResult]
    has_duplicates: bool

class HistoricalAnalysisRequest(BaseModel):
    start_date: str
    end_date: str
    max_sip_200: int = 0
    selected_sip_codes: List[int]

class HistoricalAnalysisResponse(BaseModel):
    run_id: str
    no_response: List[Dict[str, Any]] = []
    minimum_response: List[Dict[str, Any]] = []
    stats: Dict[str, Any] = {}
    no_response_file: Optional[str] = None
    minimum_response_file: Optional[str] = None
