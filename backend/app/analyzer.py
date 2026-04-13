import pandas as pd
import os
from datetime import datetime, timedelta
import logging
from typing import Dict, Any, Optional, List
from .database import (
    is_file_processed, 
    register_processed_batch, 
    save_daily_summary, 
    get_historical_summary, 
    get_file_hash,
    create_analysis_run,
    complete_analysis_run,
    save_analysis_run_numbers,
    get_historical_analysis_run,
    save_historical_analysis_run,
    get_connection
)

logger = logging.getLogger(__name__)

def safe_to_float(series, col_name, file_path=None, error_list=None):
    """
    Safely converts a series to float, handling thousands/decimal separators and providing row-level context on error.
    """
    if not pd.api.types.is_numeric_dtype(series):
        # Normalize: trim and handle separators
        from .utils import robust_numeric_normalize
        series = series.apply(lambda x: robust_numeric_normalize(x) if isinstance(x, str) else x)
    
    converted = pd.to_numeric(series, errors='coerce')
    
    # Check for failures (NaNs that weren't NaNs before)
    mask = converted.isna() & series.notna()
    if mask.any():
        # Find first failure
        first_fail_idx = series[mask].index[0]
        fail_val = series.loc[first_fail_idx]
        file_info = f" en el archivo '{os.path.basename(file_path)}'" if file_path else ""
        # Index is 0-based, so add 2 (1 for header, 1 for 1-based index)
        row_info = f", fila {first_fail_idx + 2}"
        err_msg = f"Error al convertir la columna '{col_name}'{file_info}{row_info}. Valor inválido: '{fail_val}'"
        
        if error_list is not None:
            if err_msg not in error_list: # Avoid duplicates if many rows fail similarly
                error_list.append(err_msg)
        else:
            logger.warning(err_msg)
    
    return converted

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

# Base de numeración nacional Brasil v3 (Simulada/In-memory)
# En un entorno real, esto se cargaría desde un archivo o base de datos.
# Formato: (DDD, Prefijo) -> Operadora
BRAZIL_OPERATORS_BASE = {
    # São Paulo (11)
    ('11', '991'): 'VIVO', ('11', '992'): 'VIVO', ('11', '993'): 'VIVO', ('11', '994'): 'VIVO',
    ('11', '981'): 'TIM', ('11', '982'): 'TIM', ('11', '983'): 'TIM',
    ('11', '971'): 'CLARO', ('11', '972'): 'CLARO', ('11', '973'): 'CLARO',
    ('11', '995'): 'ALGAR',
    # Rio de Janeiro (21)
    ('21', '991'): 'VIVO', ('21', '981'): 'TIM', ('21', '971'): 'CLARO',
    # Minas Gerais (31)
    ('31', '991'): 'VIVO', ('31', '981'): 'TIM', ('31', '971'): 'CLARO', ('31', '951'): 'ALGAR',
}

# Expandir la base para cubrir más DDDs de forma genérica para la simulación
for ddd in DDD_REGION_MAP.keys():
    if (ddd, '991') not in BRAZIL_OPERATORS_BASE:
        BRAZIL_OPERATORS_BASE[(ddd, '991')] = 'VIVO'
        BRAZIL_OPERATORS_BASE[(ddd, '981')] = 'TIM'
        BRAZIL_OPERATORS_BASE[(ddd, '971')] = 'CLARO'
        if ddd in ['34', '35', '37', '38']: # Áreas comunes de Algar
            BRAZIL_OPERATORS_BASE[(ddd, '951')] = 'ALGAR'

def get_operator_from_base(e164: str) -> str:
    """
    Determina la operadora basada en el DDD y el prefijo del número.
    Lógica:
    - Extraer DDD (posiciones 2-4 si empieza con 55)
    - Remover el primer '9' del número local si existe
    - Consultar prefijo de 2 a 4 dígitos
    """
    if not isinstance(e164, str) or len(e164) < 4:
        return "UNKNOWN"
    
    # Extraer DDD
    if e164.startswith('55'):
        ddd = e164[2:4]
        local_num = e164[4:]
    else:
        # Asumir que el número empieza con DDD si no tiene 55
        ddd = e164[:2]
        local_num = e164[2:]
    
    if ddd not in DDD_REGION_MAP:
        return "UNKNOWN"
    
    # Remover el primer '9' si es móvil (Brasil tiene 9 dígitos para móviles)
    if len(local_num) >= 9 and local_num.startswith('9'):
        prefix_source = local_num[1:]
    else:
        prefix_source = local_num
    
    # Probar prefijos de 4, 3 y 2 dígitos
    for length in [4, 3, 2]:
        if len(prefix_source) >= length:
            prefix = prefix_source[:length]
            op = BRAZIL_OPERATORS_BASE.get((ddd, prefix))
            if op:
                return op
                
    return "UNKNOWN"

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
    check_cancellation = None,
    use_history: bool = True,
    history_days: int = 30,
    input_filenames: Optional[List[str]] = None,
    job_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Analyzes multiple CDR CSV files in chunks to handle large files.
    Supports incremental analysis and deduplication.
    """
    # Initialize summary with default values to avoid UnboundLocalError
    summary = {
        'total_registros': 0,
        'total_numeros_unicos': 0,
        'numeros_excluidos_200': 0,
        'numeros_excluidos_404': 0,
        'numeros_con_frecuencia_insuficiente': 0,
        'numeros_match': 0,
        'numeros_no_match': 0,
        'filas_invalidas_descartadas': 0,
        'numeros_con_no_response': 0,
        'numeros_sin_no_response': 0,
        'inactiva_count': 0,
        'indeterminada_count': 0,
        'activa_count': 0,
        'inactiva_pct': 0,
        'indeterminada_pct': 0,
        'activa_pct': 0,
        'first_date': None,
        'last_date': None,
        'conversion_errors': [],
        'files_skipped': [],
        'days_considered': []
    }

    try:
        # Pass 0: Deduplication
        if progress_callback:
            progress_callback(0, "deduplication", "Verificando archivos ya procesados...")
        
        valid_input_paths = []
        skipped_filenames = []
        
        for i, path in enumerate(input_paths):
            filename = input_filenames[i] if input_filenames and i < len(input_filenames) else os.path.basename(path)
            if is_file_processed(filename, path):
                logger.info(f"DEDUPLICACIÓN: Omitiendo archivo ya procesado: {filename}")
                skipped_filenames.append(filename)
            else:
                logger.info(f"DEDUPLICACIÓN: Archivo nuevo detectado: {filename}")
                valid_input_paths.append((path, filename))
                
        # Pass 1: Find max_date across ALL files (even skipped ones to know the current window)
        # Actually, if we skip files, we might not want to scan them again. 
        # But we need to know the max_date of the "current batch" or "current state".
        # Let's scan only valid files for max_date, and if none, we'll use DB max date later.
        
        if progress_callback:
            progress_callback(5, "scanning_dates", "Escaneando fechas y validando archivos...")
        
        max_date = None
        total_rows = 0
        invalid_rows = 0
        
        # Pass 1
        for input_path, filename in valid_input_paths:
            file_rows = 0
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
                    
                chunk_len = len(chunk)
                total_rows += chunk_len
                file_rows += chunk_len
                chunk['call_date'] = pd.to_datetime(chunk['call_date'], errors='coerce')
                
                chunk_invalid = chunk['call_date'].isna().sum()
                invalid_rows += chunk_invalid
                
                current_max = chunk['call_date'].max()
                if max_date is None or (current_max is not None and current_max > max_date):
                    max_date = current_max
                
                if progress_callback:
                    progress_callback(5 + int((total_rows / 20000000) * 15), "scanning_dates", f"Escaneando fechas... {total_rows} filas")

        # If no new files, we might still want to run analysis on history
        if max_date is None and use_history:
            # Try to get max date from DB
            from .database import get_connection
            conn = get_connection()
            res = conn.execute("SELECT MAX(summary_date) FROM number_daily_summary").fetchone()
            conn.close()
            if res and res[0]:
                max_date = pd.to_datetime(res[0])
                logger.info(f"HISTORIAL: No hay archivos nuevos, usando fecha máxima de la base de datos: {max_date}")
            else:
                logger.info("HISTORIAL: No hay archivos nuevos ni datos en la base de datos.")

        if max_date is None:
            if skipped_filenames:
                raise ValueError("Todos los archivos ya fueron procesados y no hay datos nuevos para analizar.")
            else:
                raise ValueError("No se encontraron fechas válidas en los archivos.")

        start_date = max_date - timedelta(days=analysis_days)
        history_start_date = max_date - timedelta(days=history_days)
        
        # Create analysis run record
        run_id = None
        if job_id:
            run_id = create_analysis_run(
                job_id, "no_response", 
                str(start_date.date()), str(max_date.date()), 
                use_history, history_days, True
            )
            logger.info(f"DB: Registro de ejecución de análisis creado (ID: {run_id})")
        
        logger.info(f"Max date: {max_date}, Start date: {start_date}, History start: {history_start_date}")

        # Pass 2: Aggregate metrics
        if progress_callback:
            progress_callback(20, "processing_chunks", f"Procesando bloques (Ventana: {start_date.date()} a {max_date.date()})...")

        # stats: e164 -> {total, sip_counts, first_date, last_date, days, total_secs}
        stats = {}
        all_sip_codes = set()
        conversion_errors = []
        
        rows_processed_pass2 = 0
        days_considered = set()
        
        for input_path, filename in valid_input_paths:
            file_start_date = None
            file_end_date = None
            
            # We'll also collect daily stats for the DB
            # (e164, date) -> {total_intentos, total_200ok, ...}
            file_daily_stats = {}
            
            for chunk in pd.read_csv(
                input_path, 
                sep=';', 
                usecols=['call_date', 'e164', 'sip_code', 'tot_secs'], 
                dtype={'e164': str},
                chunksize=chunk_size,
                engine='c'
            ):
                if check_cancellation:
                    check_cancellation()
                    
                rows_processed_pass2 += len(chunk)
                
                chunk['call_date'] = pd.to_datetime(chunk['call_date'], errors='coerce')
                chunk['sip_code'] = safe_to_float(chunk['sip_code'], 'sip_code', input_path, conversion_errors)
                chunk['tot_secs'] = safe_to_float(chunk['tot_secs'], 'tot_secs', input_path, conversion_errors)
                
                chunk = chunk.dropna(subset=['call_date', 'e164', 'sip_code', 'tot_secs'])
                if chunk.empty: continue
                
                chunk['sip_code'] = chunk['sip_code'].astype(int)
                chunk['date_only'] = chunk['call_date'].dt.date
                
                # Update file date range
                c_min = chunk['call_date'].min()
                c_max = chunk['call_date'].max()
                if file_start_date is None or c_min < file_start_date: file_start_date = c_min
                if file_end_date is None or c_max > file_end_date: file_end_date = c_max
                
                # --- Incremental DB Aggregation ---
                # Group by e164 and date for DB
                db_agg = chunk.groupby(['e164', 'date_only']).agg(
                    total_intentos=('sip_code', 'count'),
                    total_200ok=('sip_code', lambda x: (x == 200).sum()),
                    total_404=('sip_code', lambda x: (x == 404).sum()),
                    total_480=('sip_code', lambda x: (x == 480).sum()),
                    total_486=('sip_code', lambda x: (x == 486).sum()),
                    total_487=('sip_code', lambda x: (x == 487).sum()),
                    total_500=('sip_code', lambda x: (x == 500).sum()),
                    total_503=('sip_code', lambda x: (x == 503).sum()),
                    total_603=('sip_code', lambda x: (x == 603).sum()),
                    total_secs=('tot_secs', 'sum'),
                    max_secs=('tot_secs', 'max'),
                    min_secs=('tot_secs', 'min')
                )
                
                for (e164, d_only), row in db_agg.iterrows():
                    key = (e164, str(d_only))
                    if key not in file_daily_stats:
                        file_daily_stats[key] = row.to_dict()
                        file_daily_stats[key]['otros_sip_codes'] = row['total_intentos'] - (
                            row['total_200ok'] + row['total_404'] + row['total_480'] + 
                            row['total_486'] + row['total_487'] + row['total_500'] + 
                            row['total_503'] + row['total_603']
                        )
                    else:
                        s = file_daily_stats[key]
                        s['total_intentos'] += row['total_intentos']
                        s['total_200ok'] += row['total_200ok']
                        s['total_404'] += row['total_404']
                        s['total_480'] += row['total_480']
                        s['total_486'] += row['total_486']
                        s['total_487'] += row['total_487']
                        s['total_500'] += row['total_500']
                        s['total_503'] += row['total_503']
                        s['total_603'] += row['total_603']
                        s['total_secs'] += row['total_secs']
                        s['max_secs'] = max(s['max_secs'], row['max_secs'])
                        s['min_secs'] = min(s['min_secs'], row['min_secs'])
                        s['otros_sip_codes'] += row['total_intentos'] - (
                            row['total_200ok'] + row['total_404'] + row['total_480'] + 
                            row['total_486'] + row['total_487'] + row['total_500'] + 
                            row['total_503'] + row['total_603']
                        )

                # --- Current Analysis Aggregation (only if in window) ---
                chunk_in_window = chunk[chunk['call_date'] >= start_date]
                if not chunk_in_window.empty:
                    days_considered.update(chunk_in_window['date_only'].unique())
                    all_sip_codes.update(chunk_in_window['sip_code'].unique())
                    
                    sip_counts_chunk = chunk_in_window.groupby(['e164', 'sip_code']).size()
                    basic_stats_chunk = chunk_in_window.groupby('e164').agg(
                        total=('sip_code', 'count'),
                        min_dt=('call_date', 'min'),
                        max_dt=('call_date', 'max'),
                        unique_days=('date_only', lambda x: set(x)),
                        sum_secs=('tot_secs', 'sum')
                    )
                    
                    for (e164, sip_code), count in sip_counts_chunk.items():
                        if e164 not in stats:
                            stats[e164] = {'total': 0, 'sip_counts': {}, 'first_date': None, 'last_date': None, 'days': set(), 'total_secs': 0}
                        stats[e164]['sip_counts'][sip_code] = stats[e164]['sip_counts'].get(sip_code, 0) + count
                    
                    for e164, row in basic_stats_chunk.iterrows():
                        s = stats[e164]
                        s['total'] += row['total']
                        s['total_secs'] += row['sum_secs']
                        if s['first_date'] is None or row['min_dt'] < s['first_date']: s['first_date'] = row['min_dt']
                        if s['last_date'] is None or row['max_dt'] > s['last_date']: s['last_date'] = row['max_dt']
                        s['days'].update(row['unique_days'])
                
                if progress_callback:
                    p = 20 + int((rows_processed_pass2 / total_rows) * 50)
                    progress_callback(p, "processing_chunks", f"Analizando registros... {rows_processed_pass2}/{total_rows}", processed_records=rows_processed_pass2)

            # Save file daily stats to DB
            if file_daily_stats:
                f_hash = get_file_hash(input_path)
                batch_id = register_processed_batch(
                    filename, filename, f_hash, 
                    str(file_start_date.date()) if file_start_date else None, 
                    str(file_end_date.date()) if file_end_date else None,
                    total_rows # This is total_rows of the whole batch, but we only have chunk rows here. 
                               # Actually Pass 1 calculated total_rows for the whole file.
                )
                logger.info(f"DB: Lote registrado en processed_batches (ID: {batch_id}, Hash: {f_hash[:10]}...)")
                
                db_df = pd.DataFrame([{'e164': k[0], 'date': k[1], **v} for k, v in file_daily_stats.items()])
                save_daily_summary(db_df, batch_id)
                logger.info(f"DB: {len(db_df)} resúmenes diarios guardados/actualizados en number_daily_summary")

        # --- Merge with History ---
        if use_history:
            if progress_callback:
                progress_callback(75, "loading_history", "Combinando con datos históricos...")
                
            # Use history_days window
            logger.info(f"HISTORIAL: Cargando datos desde {history_start_date.date()} hasta {max_date.date()}")
            hist_df = get_historical_summary(str(history_start_date.date()), str(max_date.date()))
            
            if not hist_df.empty:
                logger.info(f"HISTORIAL: {len(hist_df)} números recuperados de la base de datos")
                
                # Update total_rows with historical attempts if this is a history-only run or to reflect full scope
                # We only add if they are not already counted in total_rows (which comes from Pass 1)
                # Since Pass 1 only counts NEW files, adding historical attempts is correct for the "Total Registros" scope.
                total_rows += int(hist_df['total_intentos'].sum())
                
                for _, row in hist_df.iterrows():
                    e164 = row['e164']
                    if e164 not in stats:
                        stats[e164] = {'total': 0, 'sip_counts': {}, 'first_date': None, 'last_date': None, 'days': set(), 'total_secs': 0}
                    
                    s = stats[e164]
                    # We need to be careful not to double count if the current batch already included some of these days
                    # But the deduplication logic (is_file_processed) should prevent this if we only process new files.
                    # If the user uploads a file that overlaps with existing days in DB, 
                    # we currently ADD them (as per save_daily_stats ON CONFLICT DO UPDATE SET total = total + excluded.total).
                    # This might be a bit loose but matches the "avoid duplicating cases already considered if the file is the SAME" requirement.
                    
                    # Overwrite with aggregated data from DB (which includes current batch)
                    # to avoid double counting and ensure full window coverage.
                    s['total'] = int(row['total_intentos'])
                    s['total_secs'] = float(row['total_secs'])
                    s['first_date'] = pd.to_datetime(row['first_date'])
                    s['last_date'] = pd.to_datetime(row['last_date'])
                    s['historical_days_count'] = int(row['dias_con_actividad'])
                    
                    # Rebuild SIP counts from DB (main codes + others)
                    new_sip_counts = {}
                    for code in [200, 404, 480, 486, 487, 500, 503, 603]:
                        col = 'total_200ok' if code == 200 else f'total_{code}'
                        if col in row and row[col] > 0:
                            new_sip_counts[code] = int(row[col])
                            all_sip_codes.add(code)
                    
                    if 'otros_sip_codes' in row and row['otros_sip_codes'] > 0:
                        new_sip_counts[999] = int(row['otros_sip_codes'])
                    
                    s['sip_counts'] = new_sip_counts

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

        # LineState counters
        inactiva_count = 0
        indeterminada_count = 0
        activa_count = 0

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

            # Calculate number of days for frequency
            # Priority: historical_days_count (from DB) > len(days) (from current batch)
            num_days = data.get('historical_days_count', 0)
            if num_days == 0:
                num_days = len(data.get('days', []))
                
            avg_daily_frequency = total / num_days if num_days > 0 else 0

            # LineState Calculation
            avg_duration = data['total_secs'] / total if total > 0 else 0
            if avg_duration < 5:
                line_state = "Inactiva"
                inactiva_count += 1
            elif avg_duration < 10:
                line_state = "Indeterminada"
                indeterminada_count += 1
            else:
                line_state = "Activa"
                activa_count += 1

            res_row = {
                'e164': e164,
                'first_date': data['first_date'].strftime('%Y-%m-%d'),
                'last_date': data['last_date'].strftime('%Y-%m-%d'),
                'avg_daily_frequency': round(avg_daily_frequency, 2),
                'frequency': total,
                'pct_404': round(pct_404_val, 2),
                'LineState': line_state,
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
        base_cols = ['e164', 'first_date', 'last_date', 'avg_daily_frequency', 'frequency', 'pct_404', 'LineState', 'status']
        dynamic_cols = [f'pct_{sc}' for sc in sorted_sip_codes if sc != 404]
        cols = base_cols + dynamic_cols
        
        df_results = pd.DataFrame(results, columns=cols)
        df_results.to_csv(output_path, index=False, sep=';')

        # Pass 3: Extract detailed CDR matches for NO_RESPONSE_TEMP
        if progress_callback:
            progress_callback(95, "saving_details", "Generando detalle de registros para números detectados...")

        # Use the requested naming convention: detailed_{job_id}.csv
        results_dir = os.path.dirname(output_path)
        detailed_filename = os.path.basename(output_path).replace("result_", "detailed_")
        detailed_output_path = os.path.join(results_dir, detailed_filename)
        
        first_chunk_detailed = True
        target_numbers_set = set(df_results['e164'].unique())
        detailed_file_exists = False
        
        if not target_numbers_set:
            logger.info("No se detectaron números NO_RESPONSE_TEMP. Creando archivo de detalle vacío.")
            # Create an empty CSV with headers if possible, or just an empty file
            # We use the columns from the first valid input file if available
            try:
                if valid_input_paths:
                    sample_df = pd.read_csv(valid_input_paths[0][0], sep=';', nrows=0)
                    sample_df.to_csv(detailed_output_path, index=False, sep=';')
                    detailed_file_exists = True
            except Exception as e:
                logger.error(f"Error al crear archivo de detalle vacío: {e}")
        else:
            for input_path, filename in valid_input_paths:
                for chunk in pd.read_csv(
                    input_path, 
                    sep=';', 
                    dtype={'e164': str},
                    chunksize=chunk_size,
                    engine='c'
                ):
                    if check_cancellation: check_cancellation()
                    
                    # Filter chunk to only include target numbers
                    matched_chunk = chunk[chunk['e164'].isin(target_numbers_set)].copy()
                    
                    if first_chunk_detailed:
                        # Always create the file on the first chunk attempt
                        matched_chunk.to_csv(
                            detailed_output_path, 
                            mode='w', 
                            index=False, 
                            sep=';',
                            header=True
                        )
                        first_chunk_detailed = False
                        detailed_file_exists = True
                    elif not matched_chunk.empty:
                        # Append only if there are records
                        matched_chunk.to_csv(
                            detailed_output_path, 
                            mode='a', 
                            index=False, 
                            sep=';',
                            header=False
                        )

        # Construct final summary before using it in complete_analysis_run
        # We update the existing summary object to ensure it's always available
        summary.update({
            'detailed_result_path': detailed_output_path if detailed_file_exists else None,
            # Spanish keys for frontend compatibility
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
            'inactiva_count': inactiva_count,
            'indeterminada_count': indeterminada_count,
            'activa_count': activa_count,
            'inactiva_pct': round((inactiva_count / numeros_match * 100), 2) if numeros_match > 0 else 0,
            'indeterminada_pct': round((indeterminada_count / numeros_match * 100), 2) if numeros_match > 0 else 0,
            'activa_pct': round((activa_count / numeros_match * 100), 2) if numeros_match > 0 else 0,
            
            # English keys as requested by user
            'total_records': total_rows,
            'unique_numbers': total_numeros_unicos,
            'no_response_matches': numeros_match,
            'no_match': numeros_no_match,
            'excluded_200': numeros_excluidos_200,
            'excluded_pct404': numeros_excluidos_404,
            'insufficient_frequency': numeros_con_frecuencia_insuficiente,
            'invalid_rows': invalid_rows,
            'con_no_response': numeros_con_no_response,
            'sin_no_response': numeros_sin_no_response,
            
            'first_date': global_first_date.strftime('%Y-%m-%d') if global_first_date else None,
            'last_date': global_last_date.strftime('%Y-%m-%d') if global_last_date else None,
            'conversion_errors': conversion_errors[:10], # Show first 10 errors
            'files_skipped': skipped_filenames,
            'days_considered': [str(d) for d in sorted(list(days_considered))]
        })

        # Record analysis results in DB
        if run_id:
            complete_analysis_run(
                run_id, total_numeros_unicos, len(results), output_path, summary,
                detailed_result_path=detailed_output_path if detailed_file_exists else None
            )
            logger.info(f"DB: Ejecución de análisis {run_id} marcada como completada")
            
            # Prepare detailed results for DB
            db_results = []
            for e164, data in stats.items():
                # Only include those that were flagged (in results) or all?
                # Usually we want all analyzed numbers for full traceability
                is_flagged = any(r['e164'] == e164 for r in results)
                
                total = data['total']
                sip_counts = data['sip_counts']
                
                db_results.append({
                    'e164': e164,
                    'status': 'FLAGGED' if is_flagged else 'CLEAN',
                    'total_attempts': total,
                    'total_200ok': sip_counts.get(200, 0),
                    'total_404': sip_counts.get(404, 0),
                    'total_480': sip_counts.get(480, 0),
                    'total_487': sip_counts.get(487, 0),
                    'total_503': sip_counts.get(503, 0),
                    'avg_secs': data['total_secs'] / total if total > 0 else 0,
                    'days_observed': data.get('historical_days_count', len(data.get('days', []))),
                    'days_without_200ok': 0, # Logic could be added to calculate this
                    'from_history': 1 if 'historical_days_count' in data else 0
                })
            
            save_analysis_run_numbers(run_id, db_results)
            logger.info(f"DB: {len(db_results)} resultados individuales guardados en analysis_run_numbers")

        if progress_callback:
            progress_callback(100, "completed", "Análisis completado exitosamente.")

        return summary

    except Exception as e:
        logger.error(f"Error in CDR analyzer: {str(e)}")
        if progress_callback:
            progress_callback(0, "failed", f"Error: {str(e)}")
        
        # Defensive protection: ensure summary exists and return it instead of failing
        # Since we initialized it at the top, it should always exist
        if 'summary' not in locals() or summary is None:
            summary = {
                'total_registros': 0,
                'total_numeros_unicos': 0,
                'numeros_excluidos_200': 0,
                'numeros_excluidos_404': 0,
                'numeros_con_frecuencia_insuficiente': 0,
                'numeros_match': 0,
                'numeros_no_match': 0,
                'filas_invalidas_descartadas': 0,
                'numeros_con_no_response': 0,
                'numeros_sin_no_response': 0,
                'inactiva_count': 0,
                'indeterminada_count': 0,
                'activa_count': 0,
                'inactiva_pct': 0,
                'indeterminada_pct': 0,
                'activa_pct': 0,
                'first_date': None,
                'last_date': None,
                'conversion_errors': [str(e)],
                'files_skipped': [],
                'days_considered': []
            }
        else:
            # If it exists, at least add the error to conversion_errors
            if 'conversion_errors' in summary:
                summary['conversion_errors'].append(str(e))
            else:
                summary['conversion_errors'] = [str(e)]
                
        return summary

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
    # Initialize summary with default values to avoid UnboundLocalError
    summary = {
        'total_intentos': 0,
        'intentos_atendidos': 0,
        'intentos_no_atendidos': 0,
        'asr_global': 0,
        'first_date': None,
        'last_date': None,
        'by_ddd': [],
        'by_region': [],
        'by_date': [],
        'by_hour': [],
        'by_client': [],
        'by_route': [],
        'by_operator': [],
        'by_ddd_operator': [],
        'filas_invalidas_descartadas': 0,
        'conversion_errors': []
    }

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
            'route': {},
            'operator': {},
            'ddd_operator': {}
        }
        
        total_intentos = 0
        intentos_atendidos = 0
        rows_processed = 0
        global_first_date = None
        global_last_date = None
        conversion_errors = []

        for input_path in input_paths:
            # Usecols for ASR
            cols = ['call_date', 'e164', 'sip_code', 'client_code', 'route_code']
            for chunk in pd.read_csv(
                input_path, 
                sep=';', 
                usecols=cols, 
                dtype={'e164': str, 'client_code': str, 'route_code': str}, # Read sip_code as object
                chunksize=chunk_size,
                engine='c'
            ):
                if check_cancellation:
                    check_cancellation()
                
                rows_processed += len(chunk)
                chunk['call_date'] = pd.to_datetime(chunk['call_date'], errors='coerce')
                
                # Robust numeric conversion
                chunk['sip_code'] = safe_to_float(chunk['sip_code'], 'sip_code', input_path, conversion_errors)
                
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
                
                # Operator
                chunk['operator'] = chunk['e164'].apply(get_operator_from_base)
                chunk['ddd_operator'] = chunk['ddd'] + " | " + chunk['operator']
                
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
                agg_dim('operator', 'operator')
                agg_dim('ddd_operator', 'ddd_operator')

                if progress_callback:
                    p = 20 + int((rows_processed / total_rows) * 70)
                    progress_callback(p, "processing_chunks", f"Analizando registros ASR... {rows_processed}/{total_rows}", processed_records=rows_processed)

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
        
        summary.update({
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
            'by_operator': format_dim('operator'),
            'by_ddd_operator': format_dim('ddd_operator'),
            'filas_invalidas_descartadas': invalid_rows,
            'conversion_errors': conversion_errors[:10]
        })

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
        
        # Defensive protection
        if 'summary' not in locals() or summary is None:
            summary = {
                'total_intentos': 0,
                'intentos_atendidos': 0,
                'intentos_no_atendidos': 0,
                'asr_global': 0,
                'first_date': None,
                'last_date': None,
                'by_ddd': [],
                'by_region': [],
                'by_date': [],
                'by_hour': [],
                'by_client': [],
                'by_route': [],
                'by_operator': [],
                'by_ddd_operator': [],
                'filas_invalidas_descartadas': 0,
                'conversion_errors': [str(e)]
            }
        return summary

def analyze_no_response_validation(
    target_path: str,
    cdr_paths: list[str],
    output_path: str,
    analysis_days: int,
    min_total_frequency: int = 30,
    min_avg_daily_frequency: float = 5.0,
    chunk_size: int = 500000,
    progress_callback = None,
    check_cancellation = None
) -> Dict[str, Any]:
    """
    Validates a list of NO_RESPONSE numbers against CDR files.
    """
    # Initialize summary with default values to avoid UnboundLocalError
    summary = {
        'tp_count': 0,
        'fp_count': 0,
        'precision': 0,
        'error_rate': 0,
        'total_analizados': 0,
        'pct_con_respuesta': 0,
        'filas_invalidas_descartadas': 0,
        'first_date': None,
        'last_date': None,
        'cdr_stats': [],
        'original_target_count': 0,
        'filtered_target_count': 0,
        'reduction_pct': 0,
        'tp_line_state': {},
        'total_line_state': {},
        'linestate_distribution': {},
        'linestate_matches': 0,
        'has_target_linestate': False,
        'conversion_errors': []
    }

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
            
        original_target_numbers = set(target_df['e164'].dropna().unique())
        original_target_count = len(original_target_numbers)
        
        if original_target_count == 0:
            raise ValueError("No se encontraron números válidos en el archivo de objetivos.")

        # Apply filters if columns exist (they should if coming from NO_RESPONSE Analysis)
        filtered_df = target_df.copy()
        conversion_errors = []
        if 'frequency' in filtered_df.columns:
            filtered_df['frequency'] = safe_to_float(filtered_df['frequency'], 'frequency', target_path, conversion_errors)
            filtered_df = filtered_df[filtered_df['frequency'] >= min_total_frequency]
        
        if 'avg_daily_frequency' in filtered_df.columns:
            filtered_df['avg_daily_frequency'] = safe_to_float(filtered_df['avg_daily_frequency'], 'avg_daily_frequency', target_path, conversion_errors)
            filtered_df = filtered_df[filtered_df['avg_daily_frequency'] >= min_avg_daily_frequency]
            
        target_numbers = set(filtered_df['e164'].dropna().unique())
        filtered_target_count = len(target_numbers)
        reduction_pct = round(((original_target_count - filtered_target_count) / original_target_count * 100), 2) if original_target_count > 0 else 0

        if filtered_target_count == 0:
            # We don't want to raise error here, just return empty stats or handle it
            # But for validation to work, we need at least one target
            logger.warning(f"No targets left after filtering. Original: {original_target_count}, Filtered: 0")
            # We'll continue but results will be empty

        # Calculate LineState distribution for NO_RESPONSE_TEMP records if columns exist
        linestate_distribution = None
        if 'status' in filtered_df.columns and 'LineState' in filtered_df.columns:
            no_response_temp_df = filtered_df[filtered_df['status'] == 'NO_RESPONSE_TEMP']
            if not no_response_temp_df.empty:
                counts = no_response_temp_df['LineState'].value_counts()
                total_nr_temp = len(no_response_temp_df)
                linestate_distribution = {}
                for category in ['Active', 'Inactive', 'Indeterminate']:
                    count = int(counts.get(category, 0))
                    percentage = round((count / total_nr_temp * 100), 2) if total_nr_temp > 0 else 0
                    linestate_distribution[category] = {
                        "count": count,
                        "percentage": percentage
                    }

        # Track results: number -> has_sip_200 (bool)
        # We only care about numbers in target_numbers
        results = {num: False for num in target_numbers}
        # Track stats for LineState: number -> {total_calls, total_secs}
        validation_stats = {num: {'total': 0, 'secs': 0} for num in target_numbers}
        
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

        # Pass 2: Scan CDR for SIP 200 and LineState stats
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
                usecols=['call_date', 'e164', 'sip_code', 'tot_secs'], 
                dtype={'e164': str}, # Read sip_code/tot_secs as object
                chunksize=chunk_size
            ):
                if check_cancellation: check_cancellation()
                
                chunk_len = len(chunk)
                file_total_rows += chunk_len
                rows_processed += chunk_len
                
                chunk['call_date'] = pd.to_datetime(chunk['call_date'], errors='coerce')
                
                # Robust numeric conversion
                chunk['sip_code'] = safe_to_float(chunk['sip_code'], 'sip_code', cdr_path, conversion_errors)
                chunk['tot_secs'] = safe_to_float(chunk['tot_secs'], 'tot_secs', cdr_path, conversion_errors)
                
                chunk = chunk.dropna(subset=['call_date', 'e164', 'sip_code', 'tot_secs'])
                chunk = chunk[chunk['call_date'] >= start_date]
                
                # Filter chunk to only include target numbers
                matched_in_chunk = chunk[chunk['e164'].isin(target_numbers)]
                file_matched_rows += len(matched_in_chunk)
                
                if not matched_in_chunk.empty:
                    # Update validation stats for LineState
                    # Grouping by e164 to aggregate counts and durations
                    agg = matched_in_chunk.groupby('e164').agg(
                        count=('tot_secs', 'count'),
                        secs=('tot_secs', 'sum')
                    )
                    for num, row in agg.iterrows():
                        validation_stats[num]['total'] += row['count']
                        validation_stats[num]['secs'] += row['secs']

                    # Find numbers that have at least one SIP 200
                    responded = matched_in_chunk[matched_in_chunk['sip_code'].astype(int) == 200]['e164'].unique()
                    for num in responded:
                        results[num] = True

                if progress_callback:
                    progress_callback(20 + int((rows_processed / 10000000) * 70), "processing_cdr", f"Escaneando CDR... {rows_processed} filas", processed_records=rows_processed)
            
            cdr_stats.append({
                'filename': filename,
                'total_rows': file_total_rows,
                'matched_rows': file_matched_rows
            })

        # Final metrics
        tp = 0 # True Positive: Predicted NO_RESPONSE, Reality NO_RESPONSE (no SIP 200)
        fp = 0 # False Positive: Predicted NO_RESPONSE, Reality RESPONDE (has SIP 200)
        
        # LineState counts for TP matches
        tp_line_state = {
            'inactiva': 0,
            'indeterminada': 0,
            'activa': 0
        }

        # New: Total LineState distribution for ALL target numbers (NO_RESPONSE_TEMP)
        total_line_state = {
            'inactiva': 0,
            'indeterminada': 0,
            'activa': 0
        }

        # New: Match by LineState
        linestate_matches = 0
        has_target_linestate = 'LineState' in target_df.columns
        target_linestate_map = {}
        if has_target_linestate:
            target_linestate_map = target_df.set_index('e164')['LineState'].to_dict()

        for num, has_200 in results.items():
            # Calculate LineState for this number
            v_stats = validation_stats[num]
            avg_duration = v_stats['secs'] / v_stats['total'] if v_stats['total'] > 0 else 0
            
            if avg_duration < 5:
                current_ls = "Inactiva"
            elif avg_duration < 10:
                current_ls = "Indeterminada"
            else:
                current_ls = "Activa"
            
            # Update total distribution
            total_line_state[current_ls.lower()] += 1

            if has_200:
                fp += 1
            else:
                tp += 1
                # Update TP distribution
                tp_line_state[current_ls.lower()] += 1
                
                # Check if LineState matches target file
                if has_target_linestate:
                    target_ls = target_linestate_map.get(num)
                    if target_ls and str(target_ls).lower() == current_ls.lower():
                        linestate_matches += 1
        
        total = tp + fp
        precision = (tp / total * 100) if total > 0 else 0
        error_rate = (fp / total * 100) if total > 0 else 0
        pct_con_respuesta = (fp / total * 100) if total > 0 else 0
        
        summary.update({
            'tp_count': tp,
            'fp_count': fp,
            'precision': round(precision, 2),
            'error_rate': round(error_rate, 2),
            'total_analizados': total,
            'pct_con_respuesta': round(pct_con_respuesta, 2),
            'filas_invalidas_descartadas': 0,
            'first_date': start_date.strftime('%Y-%m-%d'),
            'last_date': max_date.strftime('%Y-%m-%d'),
            'cdr_stats': cdr_stats,
            'original_target_count': original_target_count,
            'filtered_target_count': filtered_target_count,
            'reduction_pct': reduction_pct,
            'tp_line_state': tp_line_state,
            'total_line_state': total_line_state,
            'linestate_distribution': linestate_distribution,
            'linestate_matches': linestate_matches,
            'has_target_linestate': has_target_linestate,
            'conversion_errors': conversion_errors[:10]
        })

        # Pass 3: Extract detailed CDR matches
        if progress_callback:
            progress_callback(90, "saving_details", "Generando detalle de registros coincidentes...")

        detailed_output_path = output_path.replace(".csv", "_detailed.csv")
        first_chunk = True
        total_tp_rows = 0
        total_fp_rows = 0
        
        for cdr_path in cdr_paths:
            for chunk in pd.read_csv(
                cdr_path, 
                sep=';', 
                dtype={'e164': str}, # Read other columns as object
                chunksize=chunk_size
            ):
                if check_cancellation: check_cancellation()
                
                # Robust numeric conversion if sip_code exists in this chunk
                if 'sip_code' in chunk.columns:
                    chunk['sip_code'] = safe_to_float(chunk['sip_code'], 'sip_code', cdr_path)
                
                # Filter chunk to only include target numbers
                matched_chunk = chunk[chunk['e164'].isin(target_numbers)].copy()
                
                if not matched_chunk.empty:
                    # Count TP/FP rows
                    is_fp = matched_chunk['e164'].map(lambda x: results.get(x, False))
                    total_fp_rows += int(is_fp.sum())
                    total_tp_rows += int((~is_fp).sum())

                    # Add auxiliary columns
                    matched_chunk['classification_result'] = is_fp.map(
                        lambda x: 'FP' if x else 'TP'
                    )
                    matched_chunk['has_sip_200'] = is_fp.map(
                        lambda x: 'YES' if x else 'NO'
                    )
                    
                    matched_chunk.to_csv(
                        detailed_output_path, 
                        mode='a' if not first_chunk else 'w', 
                        index=False, 
                        sep=';',
                        header=first_chunk
                    )
                    first_chunk = False

        # Add row counts to summary
        summary.update({
            'total_cdr_rows': sum(s['total_rows'] for s in cdr_stats),
            'tp_rows': total_tp_rows,
            'fp_rows': total_fp_rows
        })

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
        
        return summary

def run_historical_no_response_analysis(
    start_date: str, 
    end_date: str, 
    max_sip_200: int, 
    selected_sip_codes: List[int],
    results_dir: str
) -> Dict[str, Any]:
    """
    Executes a historical NO_RESPONSE analysis using data from the database.
    """
    logger.info(f"HISTORICAL: Starting analysis from {start_date} to {end_date}")
    
    conn = get_connection()
    # We'll build a query that aggregates by number
    # We only consider the selected SIP codes + 200 (to count them)
    
    # Base columns for aggregation
    sip_cols = [200, 404, 480, 486, 487, 500, 503, 603]
    agg_parts = []
    for code in sip_cols:
        col_name = "total_200ok" if code == 200 else f"total_{code}"
        agg_parts.append(f"SUM({col_name}) as total_{code}")
    
    query = f"""
        SELECT 
            number_e164 as e164,
            SUM(total_attempts) as total_attempts,
            {", ".join(agg_parts)},
            SUM(total_other_sip) as total_other,
            MIN(summary_date) as first_date,
            MAX(summary_date) as last_date
        FROM number_daily_summary
        WHERE summary_date BETWEEN ? AND ?
        GROUP BY number_e164
    """
    
    df = pd.read_sql_query(query, conn, params=(start_date, end_date))
    conn.close()
    
    if df.empty:
        stats = {
            "total_numbers": 0,
            "no_response_count": 0,
            "minimum_response_count": 0
        }
        summary = {
            "no_response": [],
            "minimum_response": [],
            "stats": stats,
            "no_response_file": None,
            "minimum_response_file": None
        }
        # Save to DB even if empty to get a run_id
        run_id = save_historical_analysis_run(
            start_date, end_date, max_sip_200, selected_sip_codes, 
            summary, "", ""
        )
        summary["run_id"] = run_id
        return summary
    
    def process_row(row):
        sip_200 = int(row['total_200'])
        
        # Calculate attempts only for selected codes + 200
        relevant_attempts = sip_200
        sip_dist = {}
        
        for code in selected_sip_codes:
            if code == 200: continue
            count = int(row.get(f'total_{code}', 0))
            relevant_attempts += count
            if count > 0:
                sip_dist[code] = count
        
        if relevant_attempts == 0:
            return None
            
        # Distribution percentages
        dist_pct = {}
        for code, count in sip_dist.items():
            dist_pct[f'pct_{code}'] = round((count / relevant_attempts * 100), 2)
            
        return {
            "e164": row['e164'],
            "intentos": relevant_attempts,
            "sip_200": sip_200,
            "first_date": row['first_date'],
            "last_date": row['last_date'],
            **dist_pct
        }
    
    processed_data = []
    for _, row in df.iterrows():
        p = process_row(row)
        if p:
            processed_data.append(p)
            
    # Classification
    no_response = []
    minimum_response = []
    
    for item in processed_data:
        sip_200 = item['sip_200']
        if sip_200 == 0:
            no_response.append(item)
        elif sip_200 <= max_sip_200:
            minimum_response.append(item)
            
    stats = {
        "total_numbers": len(processed_data),
        "no_response_count": len(no_response),
        "minimum_response_count": len(minimum_response)
    }
    
    # Export CSVs
    os.makedirs(results_dir, exist_ok=True)
    job_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    no_response_path = os.path.join(results_dir, f"no_response_{job_id}.csv")
    min_response_path = os.path.join(results_dir, f"minimum_response_{job_id}.csv")
    
    def export_csv(data, path):
        if not data:
            # Create empty file with headers
            pd.DataFrame(columns=["numero", "intentos", "sip_200"]).to_csv(path, index=False, sep=';')
            return
            
        df_export = pd.DataFrame(data)
        df_export = df_export.rename(columns={"e164": "numero"})
        
        # Ensure all pct columns are present and formatted
        for code in selected_sip_codes:
            if code == 200: continue
            col = f'pct_{code}'
            if col not in df_export.columns:
                df_export[col] = 0
        
        # Reorder columns: numero, intentos, sip_200, first_date, last_date, pcts...
        cols = ["numero", "intentos", "sip_200", "first_date", "last_date"]
        pct_cols = [f'pct_{code}' for code in sorted(selected_sip_codes) if code != 200]
        df_export = df_export[cols + pct_cols]
        
        # Format decimals with comma
        for col in pct_cols:
            df_export[col] = df_export[col].apply(lambda x: str(round(x, 1)).replace('.', ','))
            
        df_export.to_csv(path, index=False, sep=';', encoding='utf-8')

    export_csv(no_response, no_response_path)
    export_csv(minimum_response, min_response_path)
    
    summary = {
        "no_response": no_response[:100], # Limit for JSON response
        "minimum_response": minimum_response[:100],
        "stats": stats,
        "no_response_file": f"no_response_{job_id}.csv",
        "minimum_response_file": f"minimum_response_{job_id}.csv",
        "run_id": 0 # Default
    }
    
    # Save to DB
    try:
        run_id = save_historical_analysis_run(
            start_date, end_date, max_sip_200, selected_sip_codes, 
            summary, no_response_path, min_response_path
        )
        if run_id:
            summary["run_id"] = run_id
    except Exception as e:
        logger.error(f"Error saving historical analysis to DB: {e}")
        # We still return the summary even if DB save fails
    
    return summary
