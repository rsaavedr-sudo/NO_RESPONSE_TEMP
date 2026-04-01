import pandas as pd
import os
import uuid
from datetime import timedelta

def analyze_cdr_file(file_path, analysis_days, min_frequency):
    # Pass 1: Find max_date and count invalid rows
    max_date = None
    invalid_rows = 0
    total_rows = 0
    
    # Use chunksize to process large files
    # We use sep=';' as requested
    for chunk in pd.read_csv(file_path, sep=';', chunksize=100000, on_bad_lines='skip'):
        total_rows += len(chunk)
        chunk['call_date_dt'] = pd.to_datetime(chunk['call_date'], errors='coerce')
        invalid_rows += chunk['call_date_dt'].isna().sum()
        
        chunk_max = chunk['call_date_dt'].max()
        if pd.notna(chunk_max):
            if max_date is None or chunk_max > max_date:
                max_date = chunk_max
                
    if max_date is None:
        return None, None
        
    cutoff_date = max_date - timedelta(days=analysis_days)
    
    # Pass 2: Accumulate stats per e164
    # stats = { e164: { total: int, c404: int, has200: bool, freqInWindow: int } }
    stats = {}
    
    for chunk in pd.read_csv(file_path, sep=';', chunksize=100000, on_bad_lines='skip'):
        chunk['call_date_dt'] = pd.to_datetime(chunk['call_date'], errors='coerce')
        chunk = chunk.dropna(subset=['call_date_dt'])
        
        # Group chunk to reduce iterations
        # Ensure sip_code is treated as string for comparison
        chunk['sip_code_str'] = chunk['sip_code'].astype(str).str.strip()
        chunk['is_200'] = chunk['sip_code_str'] == '200'
        chunk['is_404'] = chunk['sip_code_str'] == '404'
        chunk['in_window'] = chunk['call_date_dt'] >= cutoff_date
        
        grouped = chunk.groupby('e164').agg({
            'is_200': 'any',
            'is_404': 'sum',
            'in_window': 'sum',
            'call_date': 'count'
        })
        
        for e164, row in grouped.iterrows():
            e164_str = str(e164)
            if e164_str not in stats:
                stats[e164_str] = {'total': 0, 'c404': 0, 'has200': False, 'freqInWindow': 0}
            
            s = stats[e164_str]
            s['total'] += row['call_date']
            s['c404'] += row['is_404']
            s['has200'] = s['has200'] or row['is_200']
            s['freqInWindow'] += row['in_window']
                
    # Final classification and result generation
    results_list = []
    total_unique = len(stats)
    excl_200 = 0
    excl_404 = 0
    insufficient_freq = 0
    match_count = 0
    no_match_count = 0
    
    for e164, s in stats.items():
        pct_404 = s['c404'] / s['total'] if s['total'] > 0 else 0
        
        # Classification logic
        # 1. No sip_code = 200
        # 2. No more than 30% sip_code = 404
        # 3. Frequency in window >= min_frequency
        is_match = not s['has200'] and pct_404 <= 0.30 and s['freqInWindow'] >= min_frequency
        
        status = "NO_RESPONSE_TEMP" if is_match else "OTHER"
        
        if is_match:
            match_count += 1
        else:
            # Hierarchy of exclusion for stats
            if s['has200']: 
                excl_200 += 1
            elif pct_404 > 0.30: 
                excl_404 += 1
            elif s['freqInWindow'] < min_frequency: 
                insufficient_freq += 1
            no_match_count += 1
            
        results_list.append({
            'e164': e164,
            'frequency': s['freqInWindow'],
            'pct_404': f"{pct_404*100:.2f}%",
            'status': status
        })
        
    summary = {
        'total_registros': total_rows,
        'total_numeros_unicos': total_unique,
        'numeros_excluidos_200': excl_200,
        'numeros_excluidos_404': excl_404,
        'numeros_con_frecuencia_insuficiente': insufficient_freq,
        'numeros_match': match_count,
        'numeros_no_match': no_match_count,
        'filas_invalidas_descartadas': int(invalid_rows)
    }
    
    # Save to CSV
    job_id = str(uuid.uuid4())
    output_path = f"temp/results_{job_id}.csv"
    os.makedirs("temp", exist_ok=True)
    pd.DataFrame(results_list).to_csv(output_path, index=False, sep=';')
    
    return summary, job_id
