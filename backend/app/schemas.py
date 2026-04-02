from pydantic import BaseModel
from typing import Optional, Dict, Any

class AnalysisStats(BaseModel):
    total_registros: int
    total_numeros_unicos: int
    numeros_excluidos_200: int
    numeros_excluidos_404: int
    numeros_con_frecuencia_insuficiente: int
    numeros_match: int
    numeros_no_match: int
    filas_invalidas_descartadas: int
    # Pie chart specific fields
    numeros_con_no_response: int
    numeros_sin_no_response: int

class JobStatus(BaseModel):
    job_id: str
    status: str
    analysis_type: str = "no_response"
    progress_percent: int
    stage: str
    message: str
    stats: Optional[AnalysisStats] = None
    result_url: Optional[str] = None
    error: Optional[str] = None

class AnalyzeResponse(BaseModel):
    job_id: str
    status: str
    analysis_type: str
