import pandas as pd
import os
from datetime import timedelta
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

def analyze_cdr_chunked(
    input_paths: list[str],
    output_path: str,
    analysis_days: int,
    min_frequency: int,
    chunk_size: int = 500000,
    progress_callback = None
) -> Dict[str, Any]:
    """
    Analyzes multiple CDR CSV files in chunks to handle large files.
    """
    
    # Pass 1: Find max_date and basic stats across all files
    if progress_callback:
        progress_callback(0, "scanning_dates", "Escaneando fechas y validando archivos...")
    
    max_date = None
    total_rows = 0
    invalid_rows = 0
    
    # We need to know the total size for progress
    total_file_size = sum(os.path.getsize(path) for path in input_paths)
    
    try:
        # Pass 1
        for input_path in input_paths:
            for chunk in pd.read_csv(
                input_path, 
                sep=';', 
                usecols=['call_date'], 
                chunksize=chunk_size,
                on_bad_lines='warn',
                engine='c'
            ):
                total_rows += len(chunk)
                chunk['call_date'] = pd.to_datetime(chunk['call_date'], errors='coerce')
                
                chunk_invalid = chunk['call_date'].isna().sum()
                invalid_rows += chunk_invalid
                
                current_max = chunk['call_date'].max()
                if max_date is None or (current_max is not None and current_max > max_date):
                    max_date = current_max
                
                # Update progress (approximate based on rows for pass 1)
                # Pass 1 is roughly 30% of the work
                if progress_callback:
                    # We don't know total rows yet, so we use a heuristic or just show current count
                    progress_callback(int((total_rows / 40000000) * 30), "scanning_dates", f"Escaneando fechas... {total_rows} filas")

        if max_date is None:
            raise ValueError("No se encontraron fechas válidas en los archivos.")

        start_date = max_date - timedelta(days=analysis_days)
        logger.info(f"Max date: {max_date}, Start date: {start_date}")

        # Pass 2: Aggregate metrics
        if progress_callback:
            progress_callback(30, "processing_chunks", f"Procesando bloques (Ventana: {start_date.date()} a {max_date.date()})...")

        # We'll use a dictionary to accumulate stats per e164
        # e164 -> {total, has_200, count_404, first_date, last_date, days}
        stats = {}
        
        rows_processed_pass2 = 0
        
        for input_path in input_paths:
            for chunk in pd.read_csv(
                input_path, 
                sep=';', 
                usecols=['call_date', 'e164', 'sip_code'], 
                dtype={'e164': str}, # Ensure e164 is treated as string
                chunksize=chunk_size,
                engine='c'
            ):
                rows_processed_pass2 += len(chunk)
                
                # Basic cleaning
                chunk['call_date'] = pd.to_datetime(chunk['call_date'], errors='coerce')
                chunk = chunk.dropna(subset=['call_date', 'e164'])
                
                # Filter by window
                chunk = chunk[chunk['call_date'] >= start_date]
                
                if chunk.empty:
                    continue
                
                # Date only for daily frequency calculation
                chunk['date_only'] = chunk['call_date'].dt.date
                    
                # Group by e164 in this chunk
                chunk_stats = chunk.groupby('e164').agg(
                    total=('sip_code', 'count'),
                    has_200=('sip_code', lambda x: (x == 200).any()),
                    count_404=('sip_code', lambda x: (x == 404).sum()),
                    min_dt=('call_date', 'min'),
                    max_dt=('call_date', 'max'),
                    unique_days=('date_only', lambda x: set(x))
                )
                
                # Merge with global stats
                for e164, row in chunk_stats.iterrows():
                    if e164 not in stats:
                        stats[e164] = {
                            'total': 0, 
                            'has_200': False, 
                            'count_404': 0, 
                            'first_date': row['min_dt'], 
                            'last_date': row['max_dt'],
                            'days': row['unique_days']
                        }
                    
                    s = stats[e164]
                    s['total'] += row['total']
                    s['has_200'] = s['has_200'] or row['has_200']
                    s['count_404'] += row['count_404']
                    
                    if row['min_dt'] < s['first_date']:
                        s['first_date'] = row['min_dt']
                    if row['max_dt'] > s['last_date']:
                        s['last_date'] = row['max_dt']
                    
                    s['days'].update(row['unique_days'])
                
                if progress_callback:
                    # Pass 2 is 30% to 90%
                    p = 30 + int((rows_processed_pass2 / total_rows) * 60)
                    progress_callback(p, "processing_chunks", f"Analizando registros... {rows_processed_pass2}/{total_rows}")

        # Final Classification and Output Generation
        if progress_callback:
            progress_callback(90, "generating_output", "Generando archivo de resultados y estadísticas...")

        results = []
        total_numeros_unicos = len(stats)
        numeros_excluidos_200 = 0
        numeros_excluidos_404 = 0
        numeros_con_frecuencia_insuficiente = 0
        numeros_match = 0
        numeros_no_match = 0

        for e164, data in stats.items():
            total = data['total']
            has_200 = data['has_200']
            count_404 = data['count_404']
            pct_404 = (count_404 / total * 100) if total > 0 else 0
            
            is_no_response_temp = False
            
            if has_200:
                numeros_excluidos_200 += 1
            elif pct_404 > 30:
                numeros_excluidos_404 += 1
            elif total < min_frequency:
                numeros_con_frecuencia_insuficiente += 1
            else:
                is_no_response_temp = True
                numeros_match += 1
            
            if not is_no_response_temp:
                numeros_no_match += 1
                continue # Only include NO_RESPONSE_TEMP in final CSV

            num_days = len(data['days'])
            avg_daily_frequency = total / num_days if num_days > 0 else 0

            results.append({
                'e164': e164,
                'first_date': data['first_date'].strftime('%Y-%m-%d'),
                'last_date': data['last_date'].strftime('%Y-%m-%d'),
                'avg_daily_frequency': round(avg_daily_frequency, 2),
                'frequency': total,
                'pct_404': round(pct_404, 2),
                'status': 'NO_RESPONSE_TEMP'
            })

        # Write to CSV
        # Ensure columns are in requested order and headers are always present
        cols = ['e164', 'first_date', 'last_date', 'avg_daily_frequency', 'frequency', 'pct_404', 'status']
        df_results = pd.DataFrame(results, columns=cols)
        df_results.to_csv(output_path, index=False, sep=';')

        summary = {
            'total_registros': total_rows,
            'total_numeros_unicos': total_numeros_unicos,
            'numeros_excluidos_200': numeros_excluidos_200,
            'numeros_excluidos_404': numeros_excluidos_404,
            'numeros_con_frecuencia_insuficiente': numeros_con_frecuencia_insuficiente,
            'numeros_match': numeros_match,
            'numeros_no_match': numeros_no_match,
            'filas_invalidas_descartadas': invalid_rows
        }

        if progress_callback:
            progress_callback(100, "completed", "Análisis completado exitosamente.")

        return summary

    except Exception as e:
        logger.error(f"Error in analyzer: {str(e)}")
        if progress_callback:
            progress_callback(0, "failed", f"Error: {str(e)}")
        raise e
