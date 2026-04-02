import pandas as pd
import os
from datetime import timedelta
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

DDD_REGION_MAP = {
    '11': 'São Paulo', '12': 'São Paulo', '13': 'São Paulo', '14': 'São Paulo', '15': 'São Paulo', '16': 'São Paulo', '17': 'São Paulo', '18': 'São Paulo', '19': 'São Paulo',
    '21': 'Rio de Janeiro', '22': 'Rio de Janeiro', '24': 'Rio de Janeiro',
    '27': 'Espírito Santo', '28': 'Espírito Santo',
    '31': 'Minas Gerais', '32': 'Minas Gerais', '33': 'Minas Gerais', '34': 'Minas Gerais', '35': 'Minas Gerais', '37': 'Minas Gerais', '38': 'Minas Gerais',
    '41': 'Paraná', '42': 'Paraná', '43': 'Paraná', '44': 'Paraná', '45': 'Paraná', '46': 'Paraná',
    '47': 'Santa Catarina', '48': 'Santa Catarina', '49': 'Santa Catarina',
    '51': 'Rio Grande do Sul', '53': 'Rio Grande do Sul', '54': 'Rio Grande do Sul', '55': 'Rio Grande do Sul',
    '61': 'Distrito Federal',
    '62': 'Goiás', '64': 'Goiás',
    '63': 'Tocantins',
    '65': 'Mato Grosso', '66': 'Mato Grosso',
    '67': 'Mato Grosso do Sul',
    '68': 'Acre',
    '69': 'Rondônia',
    '71': 'Bahia', '73': 'Bahia', '74': 'Bahia', '75': 'Bahia', '77': 'Bahia',
    '79': 'Sergipe',
    '81': 'Pernambuco', '87': 'Pernambuco',
    '82': 'Alagoas',
    '83': 'Paraíba',
    '84': 'Rio Grande do Norte',
    '85': 'Ceará', '88': 'Ceará',
    '86': 'Piauí', '89': 'Piauí',
    '91': 'Pará', '92': 'Amazonas', '93': 'Pará', '94': 'Pará',
    '95': 'Roraima',
    '96': 'Amapá',
    '97': 'Amazonas',
    '98': 'Maranhão', '99': 'Maranhão'
}

def get_region(e164):
    if not isinstance(e164, str) or len(e164) < 4:
        return 'Desconocido', '??'
    
    # Check if starts with 55
    if e164.startswith('55'):
        ddd = e164[2:4]
        return DDD_REGION_MAP.get(ddd, 'Otros'), ddd
    
    return 'Internacional', 'INT'

def analyze_cdr_chunked(
    input_paths: list[str],
    output_path: str,
    analysis_days: int,
    min_frequency: int,
    chunk_size: int = 500000,
    progress_callback = None,
    check_cancellation = None
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
                if check_cancellation:
                    check_cancellation()
                    
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
        # e164 -> {total, sip_counts, first_date, last_date, days}
        stats = {}
        all_sip_codes = set()
        
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
                if check_cancellation:
                    check_cancellation()
                    
                rows_processed_pass2 += len(chunk)
                
                # Basic cleaning
                chunk['call_date'] = pd.to_datetime(chunk['call_date'], errors='coerce')
                chunk = chunk.dropna(subset=['call_date', 'e164', 'sip_code'])
                
                if chunk.empty:
                    continue
                
                # Ensure sip_code is integer for consistent keys
                chunk['sip_code'] = chunk['sip_code'].astype(int)
                
                # Filter by window
                chunk = chunk[chunk['call_date'] >= start_date]
                
                if chunk.empty:
                    continue
                
                # Track unique sip codes
                all_sip_codes.update(chunk['sip_code'].unique())
                
                # Date only for daily frequency calculation
                chunk['date_only'] = chunk['call_date'].dt.date
                    
                # Group by e164 and sip_code for counts
                sip_counts_chunk = chunk.groupby(['e164', 'sip_code']).size()
                
                # Group by e164 for basic metrics
                basic_stats_chunk = chunk.groupby('e164').agg(
                    total=('sip_code', 'count'),
                    min_dt=('call_date', 'min'),
                    max_dt=('call_date', 'max'),
                    unique_days=('date_only', lambda x: set(x))
                )
                
                # Merge with global stats
                for (e164, sip_code), count in sip_counts_chunk.items():
                    if e164 not in stats:
                        stats[e164] = {
                            'total': 0, 
                            'sip_counts': {},
                            'first_date': None, 
                            'last_date': None,
                            'days': set()
                        }
                    stats[e164]['sip_counts'][sip_code] = stats[e164]['sip_counts'].get(sip_code, 0) + count
                
                for e164, row in basic_stats_chunk.iterrows():
                    s = stats[e164]
                    s['total'] += row['total']
                    if s['first_date'] is None or row['min_dt'] < s['first_date']:
                        s['first_date'] = row['min_dt']
                    if s['last_date'] is None or row['max_dt'] > s['last_date']:
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
        numeros_con_no_response = 0
        numeros_sin_no_response = 0
        global_first_date = None
        global_last_date = None

        # Sort sip codes for consistent column order
        sorted_sip_codes = sorted([int(c) for c in all_sip_codes if pd.notna(c)])

        for e164, data in stats.items():
            total = data['total']
            sip_counts = data['sip_counts']
            
            # Check if number has ANY no_response code (404 or 480)
            has_no_response = (404 in sip_counts) or (480 in sip_counts)
            if has_no_response:
                numeros_con_no_response += 1
            else:
                numeros_sin_no_response += 1

            # Track global date range
            if global_first_date is None or data['first_date'] < global_first_date:
                global_first_date = data['first_date']
            if global_last_date is None or data['last_date'] > global_last_date:
                global_last_date = data['last_date']

            has_200 = 200 in sip_counts
            count_404 = sip_counts.get(404, 0)
            pct_404_val = (count_404 / total * 100) if total > 0 else 0
            
            is_no_response_temp = False
            
            if has_200:
                numeros_excluidos_200 += 1
            elif pct_404_val > 30:
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

            res_row = {
                'e164': e164,
                'first_date': data['first_date'].strftime('%Y-%m-%d'),
                'last_date': data['last_date'].strftime('%Y-%m-%d'),
                'avg_daily_frequency': round(avg_daily_frequency, 2),
                'frequency': total,
                'pct_404': round(pct_404_val, 2),
                'status': 'NO_RESPONSE_TEMP'
            }
            
            # Add dynamic pct columns
            for sc in sorted_sip_codes:
                if sc == 404:
                    continue
                sc_count = sip_counts.get(sc, 0)
                sc_pct = (sc_count / total * 100) if total > 0 else 0
                res_row[f'pct_{sc}'] = round(sc_pct, 2)

            results.append(res_row)

        # Write to CSV
        # Ensure columns are in requested order and headers are always present
        base_cols = ['e164', 'first_date', 'last_date', 'avg_daily_frequency', 'frequency', 'pct_404', 'status']
        dynamic_cols = [f'pct_{sc}' for sc in sorted_sip_codes if sc != 404]
        cols = base_cols + dynamic_cols
        
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
            'filas_invalidas_descartadas': invalid_rows,
            'numeros_con_no_response': numeros_con_no_response,
            'numeros_sin_no_response': numeros_sin_no_response,
            'first_date': global_first_date.strftime('%Y-%m-%d') if global_first_date else None,
            'last_date': global_last_date.strftime('%Y-%m-%d') if global_last_date else None
        }

        if progress_callback:
            progress_callback(100, "completed", "Análisis completado exitosamente.")

        return summary

    except Exception as e:
        logger.error(f"Error in analyzer: {str(e)}")
        if progress_callback:
            progress_callback(0, "failed", f"Error: {str(e)}")
        raise e

def analyze_asr_chunked(
    input_paths: list[str],
    output_path: str,
    analysis_days: int,
    chunk_size: int = 500000,
    progress_callback = None,
    check_cancellation = None
) -> Dict[str, Any]:
    """
    Analyzes CDR for ASR metrics across multiple dimensions.
    """
    if progress_callback:
        progress_callback(0, "scanning_dates", "Escaneando fechas y validando archivos...")

    max_date = None
    total_rows = 0
    invalid_rows = 0

    try:
        # Pass 1: Find max_date
        for input_path in input_paths:
            for chunk in pd.read_csv(
                input_path, 
                sep=';', 
                usecols=['call_date'], 
                chunksize=chunk_size,
                on_bad_lines='warn',
                engine='c'
            ):
                if check_cancellation:
                    check_cancellation()
                total_rows += len(chunk)
                chunk['call_date'] = pd.to_datetime(chunk['call_date'], errors='coerce')
                invalid_rows += chunk['call_date'].isna().sum()
                current_max = chunk['call_date'].max()
                if max_date is None or (current_max is not None and current_max > max_date):
                    max_date = current_max
                if progress_callback:
                    progress_callback(int((total_rows / 40000000) * 20), "scanning_dates", f"Escaneando fechas... {total_rows} filas")

        if max_date is None:
            raise ValueError("No se encontraron fechas válidas en los archivos.")

        start_date = max_date - timedelta(days=analysis_days)
        
        # Pass 2: Aggregate by dimensions
        if progress_callback:
            progress_callback(20, "processing_chunks", f"Procesando bloques (Ventana: {start_date.date()} a {max_date.date()})...")

        # Aggregators
        # dim -> key -> {total, attended}
        dims = {
            'ddd': {},
            'region': {},
            'date': {},
            'hour': {},
            'client': {},
            'route': {}
        }
        
        total_intentos = 0
        intentos_atendidos = 0
        rows_processed = 0
        global_first_date = None
        global_last_date = None

        for input_path in input_paths:
            # Usecols for ASR
            cols = ['call_date', 'e164', 'sip_code', 'client_code', 'route_code']
            for chunk in pd.read_csv(
                input_path, 
                sep=';', 
                usecols=cols, 
                dtype={'e164': str, 'client_code': str, 'route_code': str},
                chunksize=chunk_size,
                engine='c'
            ):
                if check_cancellation:
                    check_cancellation()
                
                rows_processed += len(chunk)
                chunk['call_date'] = pd.to_datetime(chunk['call_date'], errors='coerce')
                chunk = chunk.dropna(subset=['call_date', 'e164', 'sip_code'])
                if chunk.empty: continue
                
                chunk = chunk[chunk['call_date'] >= start_date]
                if chunk.empty: continue

                # Track global date range
                c_min = chunk['call_date'].min()
                c_max = chunk['call_date'].max()
                if global_first_date is None or c_min < global_first_date: global_first_date = c_min
                if global_last_date is None or c_max > global_last_date: global_last_date = c_max

                # Extract dimensions
                chunk['is_attended'] = (chunk['sip_code'].astype(int) == 200)
                
                # DDD and Region
                chunk['region_info'] = chunk['e164'].apply(get_region)
                chunk['region'] = chunk['region_info'].apply(lambda x: x[0])
                chunk['ddd'] = chunk['region_info'].apply(lambda x: x[1])
                
                # Date and Hour
                chunk['date'] = chunk['call_date'].dt.strftime('%Y-%m-%d')
                chunk['hour'] = chunk['call_date'].dt.hour.astype(str).str.zfill(2) + ":00"

                # Update global counts
                total_intentos += len(chunk)
                intentos_atendidos += chunk['is_attended'].sum()

                # Helper to aggregate a dimension
                def agg_dim(dim_name, col_name):
                    agg = chunk.groupby(col_name).agg(
                        total=('is_attended', 'count'),
                        attended=('is_attended', 'sum')
                    )
                    for key, row in agg.iterrows():
                        if key not in dims[dim_name]:
                            dims[dim_name][key] = {'total': 0, 'attended': 0}
                        dims[dim_name][key]['total'] += row['total']
                        dims[dim_name][key]['attended'] += row['attended']

                agg_dim('ddd', 'ddd')
                agg_dim('region', 'region')
                agg_dim('date', 'date')
                agg_dim('hour', 'hour')
                agg_dim('client', 'client_code')
                agg_dim('route', 'route_code')

                if progress_callback:
                    p = 20 + int((rows_processed / total_rows) * 70)
                    progress_callback(p, "processing_chunks", f"Analizando registros ASR... {rows_processed}/{total_rows}")

        # Final calculations
        if progress_callback:
            progress_callback(90, "generating_output", "Generando estadísticas ASR...")

        def format_dim(dim_name):
            data = []
            for key, val in dims[dim_name].items():
                total = val['total']
                attended = val['attended']
                not_attended = total - attended
                asr = (attended / total * 100) if total > 0 else 0
                data.append({
                    'category': str(key),
                    'total': int(total),
                    'attended': int(attended),
                    'not_attended': int(not_attended),
                    'asr': round(asr, 2)
                })
            # Sort by category or total? Let's sort by total descending for most
            if dim_name in ['date', 'hour']:
                return sorted(data, key=lambda x: x['category'])
            return sorted(data, key=lambda x: x['total'], reverse=True)

        asr_global = (intentos_atendidos / total_intentos * 100) if total_intentos > 0 else 0
        
        summary = {
            'total_intentos': total_intentos,
            'intentos_atendidos': intentos_atendidos,
            'intentos_no_atendidos': total_intentos - intentos_atendidos,
            'asr_global': round(asr_global, 2),
            'first_date': global_first_date.strftime('%Y-%m-%d') if global_first_date else None,
            'last_date': global_last_date.strftime('%Y-%m-%d') if global_last_date else None,
            'by_ddd': format_dim('ddd'),
            'by_region': format_dim('region'),
            'by_date': format_dim('date'),
            'by_hour': format_dim('hour'),
            'by_client': format_dim('client'),
            'by_route': format_dim('route'),
            'filas_invalidas_descartadas': invalid_rows
        }

        # Save a simple CSV with the global dimensions for download.
        all_data = []
        for d_name in dims:
            for item in summary[f'by_{d_name}']:
                item_copy = item.copy()
                item_copy['dimension'] = d_name
                all_data.append(item_copy)
        
        pd.DataFrame(all_data).to_csv(output_path, index=False, sep=';')

        if progress_callback:
            progress_callback(100, "completed", "Análisis ASR completado exitosamente.")

        return summary

    except Exception as e:
        logger.error(f"Error in ASR analyzer: {str(e)}")
        if progress_callback:
            progress_callback(0, "failed", f"Error: {str(e)}")
        raise e

def analyze_no_response_validation(
    target_path: str,
    cdr_paths: list[str],
    output_path: str,
    analysis_days: int,
    chunk_size: int = 500000,
    progress_callback = None,
    check_cancellation = None
) -> Dict[str, Any]:
    """
    Validates a list of NO_RESPONSE numbers against CDR files.
    """
    if progress_callback:
        progress_callback(0, "loading_targets", "Cargando lista de números a validar...")

    try:
        # Load target numbers
        target_df = pd.read_csv(target_path, sep=';', dtype={'e164': str})
        if 'e164' not in target_df.columns:
            # Try comma if semicolon fails
            target_df = pd.read_csv(target_path, sep=',', dtype={'e164': str})
        
        if 'e164' not in target_df.columns:
            raise ValueError("El archivo de números debe tener una columna 'e164'.")
            
        target_numbers = set(target_df['e164'].dropna().unique())
        total_targets = len(target_numbers)
        
        if total_targets == 0:
            raise ValueError("No se encontraron números válidos en el archivo de objetivos.")

        # Track results: number -> has_sip_200 (bool)
        # We only care about numbers in target_numbers
        results = {num: False for num in target_numbers}
        
        # Pass 1: Find max_date to apply window
        if progress_callback:
            progress_callback(10, "scanning_dates", "Escaneando fechas en CDR...")

        max_date = None
        for cdr_path in cdr_paths:
            for chunk in pd.read_csv(cdr_path, sep=';', usecols=['call_date'], chunksize=chunk_size):
                if check_cancellation: check_cancellation()
                chunk['call_date'] = pd.to_datetime(chunk['call_date'], errors='coerce')
                current_max = chunk['call_date'].max()
                if max_date is None or (current_max is not None and current_max > max_date):
                    max_date = current_max

        if max_date is None:
            raise ValueError("No se encontraron fechas válidas en los CDR.")

        start_date = max_date - timedelta(days=analysis_days)

        # Pass 2: Scan CDR for SIP 200
        if progress_callback:
            progress_callback(20, "processing_cdr", f"Analizando CDR (Ventana: {start_date.date()} a {max_date.date()})...")

        rows_processed = 0
        cdr_stats = []
        
        for cdr_path in cdr_paths:
            filename = os.path.basename(cdr_path)
            file_total_rows = 0
            file_matched_rows = 0
            
            for chunk in pd.read_csv(
                cdr_path, 
                sep=';', 
                usecols=['call_date', 'e164', 'sip_code'], 
                dtype={'e164': str},
                chunksize=chunk_size
            ):
                if check_cancellation: check_cancellation()
                
                chunk_len = len(chunk)
                file_total_rows += chunk_len
                rows_processed += chunk_len
                
                chunk['call_date'] = pd.to_datetime(chunk['call_date'], errors='coerce')
                chunk = chunk.dropna(subset=['call_date', 'e164', 'sip_code'])
                chunk = chunk[chunk['call_date'] >= start_date]
                
                # Filter chunk to only include target numbers
                matched_in_chunk = chunk[chunk['e164'].isin(target_numbers)]
                file_matched_rows += len(matched_in_chunk)
                
                if not matched_in_chunk.empty:
                    # Find numbers that have at least one SIP 200
                    responded = matched_in_chunk[matched_in_chunk['sip_code'].astype(int) == 200]['e164'].unique()
                    for num in responded:
                        results[num] = True

                if progress_callback:
                    progress_callback(20 + int((rows_processed / 10000000) * 70), "processing_cdr", f"Escaneando CDR... {rows_processed} filas")
            
            cdr_stats.append({
                'filename': filename,
                'total_rows': file_total_rows,
                'matched_rows': file_matched_rows
            })

        # Final metrics
        tp = 0 # True Positive: Predicted NO_RESPONSE, Reality NO_RESPONSE (no SIP 200)
        fp = 0 # False Positive: Predicted NO_RESPONSE, Reality RESPONDE (has SIP 200)
        
        for num, has_200 in results.items():
            if has_200:
                fp += 1
            else:
                tp += 1
        
        total = tp + fp
        precision = (tp / total * 100) if total > 0 else 0
        error_rate = (fp / total * 100) if total > 0 else 0
        pct_con_respuesta = (fp / total * 100) if total > 0 else 0
        
        summary = {
            'tp_count': tp,
            'fp_count': fp,
            'precision': round(precision, 2),
            'error_rate': round(error_rate, 2),
            'total_analizados': total,
            'pct_con_respuesta': round(pct_con_respuesta, 2),
            'filas_invalidas_descartadas': 0,
            'first_date': start_date.strftime('%Y-%m-%d'),
            'last_date': max_date.strftime('%Y-%m-%d'),
            'cdr_stats': cdr_stats
        }

        # Pass 3: Extract detailed CDR matches
        if progress_callback:
            progress_callback(90, "saving_details", "Generando detalle de registros coincidentes...")

        detailed_output_path = output_path.replace(".csv", "_detailed.csv")
        first_chunk = True
        
        for cdr_path in cdr_paths:
            for chunk in pd.read_csv(
                cdr_path, 
                sep=';', 
                dtype={'e164': str},
                chunksize=chunk_size
            ):
                if check_cancellation: check_cancellation()
                
                # Filter chunk to only include target numbers
                matched_chunk = chunk[chunk['e164'].isin(target_numbers)].copy()
                
                if not matched_chunk.empty:
                    # Add auxiliary columns
                    matched_chunk['classification_result'] = matched_chunk['e164'].map(
                        lambda x: 'FP' if results.get(x) else 'TP'
                    )
                    matched_chunk['has_sip_200'] = matched_chunk['e164'].map(
                        lambda x: 'YES' if results.get(x) else 'NO'
                    )
                    
                    matched_chunk.to_csv(
                        detailed_output_path, 
                        mode='a' if not first_chunk else 'w', 
                        index=False, 
                        sep=';',
                        header=first_chunk
                    )
                    first_chunk = False

        # Save summary results table as well
        results_list = []
        for num, has_200 in results.items():
            results_list.append({
                'e164': num,
                'realidad': 'RESPONDE' if has_200 else 'NO RESPONDE',
                'clasificacion': 'FP' if has_200 else 'TP'
            })
        
        pd.DataFrame(results_list).to_csv(output_path, index=False, sep=';')

        if progress_callback:
            progress_callback(100, "completed", "Validación de modelo completada.")

        return summary

    except Exception as e:
        logger.error(f"Error in validation analyzer: {str(e)}")
        if progress_callback:
            progress_callback(0, "failed", f"Error: {str(e)}")
        raise e
