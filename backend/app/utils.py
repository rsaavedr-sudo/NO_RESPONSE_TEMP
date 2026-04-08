import numpy as np
import pandas as pd
from typing import Any

def to_json_safe(obj: Any) -> Any:
    """
    Recursively converts non-serializable types (like numpy.int64, numpy.float64, etc.) 
    to native Python types for JSON serialization.
    """
    if isinstance(obj, dict):
        return {str(k): to_json_safe(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple, set)):
        return [to_json_safe(i) for i in obj]
    elif isinstance(obj, (np.int64, np.int32, np.int16, np.int8, np.integer)):
        return int(obj)
    elif isinstance(obj, (np.float64, np.float32, np.float16, np.floating)):
        return float(obj)
    elif isinstance(obj, (np.bool_)):
        return bool(obj)
    elif isinstance(obj, np.ndarray):
        return to_json_safe(obj.tolist())
    elif hasattr(obj, "isoformat") and callable(getattr(obj, "isoformat")):
        return obj.isoformat()
    elif pd.isna(obj) if not isinstance(obj, (dict, list, tuple, set, np.ndarray)) else False:
        return None
    elif hasattr(obj, "item") and callable(getattr(obj, "item")):
        # Handle other numpy scalars
        return obj.item()
    return obj

def robust_numeric_normalize(val: Any) -> str:
    """
    Normalizes a numeric string handling thousands and decimal separators.
    Supports:
    - "0,288" -> "0.288"
    - "1.234,56" -> "1234.56"
    - "1.016.658" -> "1016658"
    - "1,234.56" -> "1234.56"
    - "12.5" -> "12.5"
    """
    if val is None:
        return "0"
    if isinstance(val, (int, float)):
        return str(val)
    if not isinstance(val, str):
        val = str(val)
    
    s = val.strip()
    if not s:
        return "0"
    
    # Count occurrences
    commas = s.count(',')
    dots = s.count('.')
    
    if commas > 0 and dots > 0:
        # Both present. Determine which is which by the last one.
        if s.rfind(',') > s.rfind('.'):
            # 1.234,56 -> 1234.56 (European/LatAm)
            return s.replace('.', '').replace(',', '.')
        else:
            # 1,234.56 -> 1234.56 (US/UK)
            return s.replace(',', '')
    
    if commas > 0:
        # Only commas. 
        if commas > 1:
            # 1,234,567 -> 1234567
            return s.replace(',', '')
        else:
            # Single comma. 
            # User says: "0,288" -> 0.288
            # We treat single comma as decimal separator.
            return s.replace(',', '.')
            
    if dots > 0:
        # Only dots.
        if dots > 1:
            # 1.234.567 -> 1234567
            return s.replace('.', '')
        else:
            # Single dot.
            # "12.5" is standard decimal.
            # "1.016" is ambiguous but standard float parsing treats it as 1.016.
            return s
            
    return s

def parse_float(val: Any, field_name: str = "campo") -> float:
    """
    Parses a value to float using robust normalization.
    """
    if val is None or val == "":
        return 0.0
    
    normalized = robust_numeric_normalize(val)
    try:
        return float(normalized)
    except ValueError:
        raise ValueError(f"Error al convertir el {field_name}. Valor inválido: '{val}'")
