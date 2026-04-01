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
    elif pd.isna(obj) if not isinstance(obj, (dict, list, tuple, set, np.ndarray)) else False:
        return None
    elif hasattr(obj, "item") and callable(getattr(obj, "item")):
        # Handle other numpy scalars
        return obj.item()
    return obj
