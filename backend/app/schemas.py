from pydantic import BaseModel
from typing import List, Optional

class AnalysisStats(BaseModel):
    total_registros: int
    total_numeros_unicos: int
    numeros_excluidos_200: int
    numeros_excluidos_404: int
    numeros_con_frecuencia_insuficiente: int
    numeros_match: int
    numeros_no_match: int
    filas_invalidas_descartadas: int

class AnalysisResponse(BaseModel):
    job_id: str
    stats: AnalysisStats
