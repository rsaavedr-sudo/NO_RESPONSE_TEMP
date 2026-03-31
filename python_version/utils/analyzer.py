import pandas as pd

def analyze_cdr(df, analysis_days):
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
    match_count = 0
    no_match_count = 0
    output_list = []
    
    for e164, group in grouped:
        # Rule 1: Exclude if any sip_code = 200
        if (group['sip_code'] == 200).any():
            excluded_200 += 1
            continue
            
        # Rule 2: Exclude if pct_404 > 0.30
        pct_404 = (group['sip_code'] == 404).sum() / len(group)
        if pct_404 > 0.30:
            excluded_404 += 1
            continue
            
        # Rule 3: Universe Valid (Candidate)
        # Rule 4: Filter by time window
        group_in_window = group[group['call_date'] >= cutoff_date]
        
        # Rule 5: Classification
        if not group_in_window.empty:
            match_count += 1
            output_list.append({
                'e164': e164,
                'frequency': len(group_in_window)
            })
        else:
            no_match_count += 1
            
    results = {
        'total_numeros_unicos': total_numeros_unicos,
        'numeros_excluidos_200': excluded_200,
        'numeros_excluidos_404': excluded_404,
        'numeros_analizados': total_numeros_unicos - excluded_200 - excluded_404,
        'numeros_match': match_count,
        'numeros_no_match': no_match_count
    }
    
    output_df = pd.DataFrame(output_list)
    
    return results, output_df
