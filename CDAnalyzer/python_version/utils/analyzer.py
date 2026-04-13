import pandas as pd

def is_sip_code(record_sip, target_sip):
    if pd.isna(record_sip): return False
    s = str(record_sip).strip().lower()
    t = str(target_sip)
    
    if s == t: return True
    
    # Try hex match
    try:
        if int(s, 16) == int(t, 10): return True
    except: pass
    
    # Try decimal match
    try:
        if int(float(s)) == int(t): return True
    except: pass
    
    return False

def analyze_cdr(df, analysis_days, min_frequency=5):
    """
    Implement the business logic rules.
    """
    # Find max date
    max_date = df['call_date'].max()
    cutoff_date = max_date - pd.Timedelta(days=analysis_days)
    
    # Group by e164
    grouped = df.groupby('e164')
    
    total_numeros_unicos = len(grouped)
    excluded_200 = 0
    excluded_404 = 0
    insufficient_frequency = 0
    match_count = 0
    no_match_count = 0
    output_list = []
    
    for e164, group in grouped:
        # Rule 1: Exclude if any sip_code = 200
        has_200 = group['sip_code'].apply(lambda x: is_sip_code(x, 200)).any()
            
        # Rule 2: Exclude if pct_404 > 0.30
        is_404 = group['sip_code'].apply(lambda x: is_sip_code(x, 404))
        pct_404 = is_404.sum() / len(group)
            
        # Rule 3: Universe Valid (Candidate)
        # Rule 4: Filter by time window
        group_in_window = group[group['call_date'] >= cutoff_date]
        frequency = len(group_in_window)
        
        # Rule 5: Classification
        is_match = not has_200 and pct_404 <= 0.30 and frequency >= min_frequency
        status = "NO_RESPONSE_TEMP" if is_match else "OTHER"

        if is_match:
            match_count += 1
        else:
            if has_200:
                excluded_200 += 1
            elif pct_404 > 0.30:
                excluded_404 += 1
            elif frequency > 0 and frequency < min_frequency:
                insufficient_frequency += 1
            no_match_count += 1
            
        output_list.append({
            'e164': e164,
            'frequency': frequency,
            'pct_404': pct_404,
            'status': status
        })
            
    results = {
        'total_registros': len(df),
        'total_numeros_unicos': total_numeros_unicos,
        'numeros_excluidos_200': excluded_200,
        'numeros_excluidos_404': excluded_404,
        'numeros_con_frecuencia_insuficiente': insufficient_frequency,
        'numeros_analizados': total_numeros_unicos - excluded_200 - excluded_404,
        'numeros_match': match_count,
        'numeros_no_match': no_match_count
    }
    
    output_df = pd.DataFrame(output_list)
    
    return results, output_df
