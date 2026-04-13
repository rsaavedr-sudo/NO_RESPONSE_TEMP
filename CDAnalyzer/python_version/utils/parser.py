import pandas as pd

def parse_cdr_file(df):
    """
    Parse call_date as datetime and handle errors.
    """
    initial_count = len(df)
    
    # Parse date
    df['call_date'] = pd.to_datetime(df['call_date'], errors='coerce')
    
    # Ensure e164 is treated as string without modification
    df['e164'] = df['e164'].astype(str).str.strip()
    
    # Drop invalid dates
    df_clean = df.dropna(subset=['call_date']).copy()
    discarded_rows = initial_count - len(df_clean)
    
    return df_clean, discarded_rows
