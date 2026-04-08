import numpy as np
import pandas as pd
from typing import Any

def to_json_safe(obj: Any) -> Any:
    """
    Recursively converts non-serializable types to native Python types for JSON serialization.
    Optimized to avoid heavy checks when possible.
    """
    if isinstance(obj, (str, int, float, bool)) or obj is None:
        return obj
    if isinstance(obj, dict):
        return {str(k): to_json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [to_json_safe(i) for i in obj]
    if isinstance(obj, (np.int64, np.int32, np.int16, np.int8, np.integer)):
        return int(obj)
    if isinstance(obj, (np.float64, np.float32, np.float16, np.floating)):
        val = float(obj)
        return None if np.isnan(val) else val
    if isinstance(obj, (np.bool_)):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return to_json_safe(obj.tolist())
    if hasattr(obj, "isoformat") and callable(getattr(obj, "isoformat")):
        return obj.isoformat()
    # Fallback for other types
    try:
        if pd.isna(obj):
            return None
    except:
        pass
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
