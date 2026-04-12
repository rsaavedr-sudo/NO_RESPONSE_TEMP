import sqlite3
import os
import logging
import hashlib
import json
from datetime import datetime
from pathlib import Path
import pandas as pd
from typing import List, Dict, Any, Optional
from .utils import to_json_safe

logger = logging.getLogger(__name__)

# Database path
DB_DIR = Path(__file__).resolve().parent.parent / "data"
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DB_DIR / "incremental_analysis.db"

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes the database schema."""
    conn = get_connection()
    cursor = conn.cursor()
    
    # 1) TABLE: processed_batches
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS processed_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_name TEXT,
            source_filename TEXT,
            file_hash TEXT UNIQUE,
            period_start DATE,
            period_end DATE,
            total_rows INTEGER,
            processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            notes TEXT
        )
    """)
    
    # 2) TABLE: number_daily_summary
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS number_daily_summary (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            number_e164 TEXT,
            summary_date DATE,
            total_attempts INTEGER,
            total_200ok INTEGER,
            total_404 INTEGER,
            total_480 INTEGER,
            total_487 INTEGER,
            total_503 INTEGER,
            total_other_sip INTEGER,
            avg_tot_secs REAL,
            min_tot_secs REAL,
            max_tot_secs REAL,
            avg_daily_frequency REAL,
            has_200ok INTEGER,
            candidate_no_response INTEGER,
            source_batch_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(number_e164, summary_date),
            FOREIGN KEY (source_batch_id) REFERENCES processed_batches(id)
        )
    """)
    
    # 3) TABLE: analysis_runs
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS analysis_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id TEXT,
            analysis_type TEXT,
            period_start DATE,
            period_end DATE,
            used_history INTEGER,
            history_days INTEGER,
            deduplication_enabled INTEGER,
            status TEXT,
            total_numbers_analyzed INTEGER,
            total_numbers_flagged INTEGER,
            summary_json TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            result_file_path TEXT,
            notes TEXT
        )
    """)
    
    # 4) TABLE: analysis_run_numbers
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS analysis_run_numbers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            analysis_run_id INTEGER,
            number_e164 TEXT,
            final_status TEXT,
            total_attempts_window INTEGER,
            total_200ok_window INTEGER,
            total_404_window INTEGER,
            total_480_window INTEGER,
            total_487_window INTEGER,
            total_503_window INTEGER,
            avg_tot_secs_window REAL,
            days_observed INTEGER,
            days_without_200ok INTEGER,
            included_from_history INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (analysis_run_id) REFERENCES analysis_runs(id)
        )
    """)
    
    # 5) INDICES
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_number_date ON number_daily_summary (number_e164, summary_date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_analysis_run ON analysis_run_numbers (analysis_run_id)")
    
    # Legacy tables (keep for compatibility during migration if needed, or just remove if we want a clean start)
    # For this task, we'll stick to the requested ones.
    
    conn.commit()
    conn.close()
    logger.info(f"Database initialized at {DB_PATH}")

def get_file_hash(file_path: str) -> str:
    """Calculates SHA256 hash of a file."""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def is_file_processed(filename: str, file_path: Optional[str] = None) -> bool:
    """Checks if a file has already been processed by hash."""
    if file_path:
        f_hash = get_file_hash(file_path)
        return get_batch_by_hash(f_hash) is not None
    return False

def get_processed_batches() -> List[Dict[str, Any]]:
    """Retrieves all processed batches."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM processed_batches ORDER BY processed_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_batch_by_hash(file_hash: str) -> Optional[Dict[str, Any]]:
    """Retrieves a batch by its file hash."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM processed_batches WHERE file_hash = ?", (file_hash,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def register_processed_batch(batch_name: str, filename: str, file_hash: str, start_date: str, end_date: str, total_rows: int) -> int:
    """Registers a batch as processed and returns its ID."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO processed_batches (batch_name, source_filename, file_hash, period_start, period_end, total_rows)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (batch_name, filename, file_hash, start_date, end_date, total_rows))
    
    batch_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return batch_id

def save_daily_summary(df: pd.DataFrame, batch_id: int):
    """Saves daily summaries to the database."""
    if df.empty:
        return
        
    conn = get_connection()
    now = datetime.now().isoformat()
    
    try:
        cursor = conn.cursor()
        for _, row in df.iterrows():
            cursor.execute("""
                INSERT INTO number_daily_summary (
                    number_e164, summary_date, total_attempts, total_200ok, 
                    total_404, total_480, total_487, total_503, total_other_sip, 
                    avg_tot_secs, min_tot_secs, max_tot_secs, source_batch_id,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(number_e164, summary_date) DO UPDATE SET
                    total_attempts = total_attempts + excluded.total_attempts,
                    total_200ok = total_200ok + excluded.total_200ok,
                    total_404 = total_404 + excluded.total_404,
                    total_480 = total_480 + excluded.total_480,
                    total_487 = total_487 + excluded.total_487,
                    total_503 = total_503 + excluded.total_503,
                    total_other_sip = total_other_sip + excluded.total_other_sip,
                    avg_tot_secs = (avg_tot_secs * total_attempts + excluded.avg_tot_secs * excluded.total_attempts) / (total_attempts + excluded.total_attempts),
                    max_tot_secs = MAX(max_tot_secs, excluded.max_tot_secs),
                    min_tot_secs = MIN(min_tot_secs, excluded.min_tot_secs),
                    updated_at = excluded.updated_at,
                    source_batch_id = excluded.source_batch_id
            """, (
                row['e164'], row['date'], row['total_intentos'], row['total_200ok'], 
                row['total_404'], row['total_480'], row['total_487'], row['total_503'], 
                row['otros_sip_codes'], row['total_secs'] / row['total_intentos'] if row['total_intentos'] > 0 else 0,
                row['min_secs'], row['max_secs'], batch_id, now, now
            ))
        
        conn.commit()
    except Exception as e:
        logger.error(f"Error saving daily summary: {e}")
        conn.rollback()
    finally:
        conn.close()

def get_historical_summary(start_date: str, end_date: str) -> pd.DataFrame:
    """Retrieves aggregated historical summary for a date range."""
    conn = get_connection()
    query = """
        SELECT 
            number_e164 as e164,
            SUM(total_attempts) as total_intentos,
            SUM(total_200ok) as total_200ok,
            SUM(total_404) as total_404,
            SUM(total_480) as total_480,
            SUM(total_487) as total_487,
            SUM(total_503) as total_503,
            SUM(total_other_sip) as otros_sip_codes,
            SUM(avg_tot_secs * total_attempts) as total_secs,
            MAX(max_tot_secs) as max_secs,
            MIN(min_tot_secs) as min_secs,
            COUNT(DISTINCT summary_date) as dias_con_actividad,
            MIN(summary_date) as first_date,
            MAX(summary_date) as last_date
        FROM number_daily_summary
        WHERE summary_date >= ? AND summary_date <= ?
        GROUP BY number_e164
    """
    df = pd.read_sql_query(query, conn, params=(start_date, end_date))
    conn.close()
    return df

def create_analysis_run(job_id: str, analysis_type: str, period_start: str, period_end: str, used_history: bool, history_days: int, deduplication_enabled: bool) -> int:
    """Creates an analysis run record."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO analysis_runs (
            job_id, analysis_type, period_start, period_end, 
            used_history, history_days, deduplication_enabled, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (job_id, analysis_type, period_start, period_end, 1 if used_history else 0, history_days, 1 if deduplication_enabled else 0, 'running'))
    run_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return run_id

def complete_analysis_run(run_id: int, total_analyzed: int, total_flagged: int, result_path: str, summary: Dict[str, Any] = None):
    """Completes an analysis run record."""
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    summary_json = json.dumps(to_json_safe(summary)) if summary else None
    cursor.execute("""
        UPDATE analysis_runs 
        SET status = 'completed', completed_at = ?, total_numbers_analyzed = ?, 
            total_numbers_flagged = ?, result_file_path = ?, summary_json = ?
        WHERE id = ?
    """, (now, total_analyzed, total_flagged, result_path, summary_json, run_id))
    conn.commit()
    conn.close()

def save_analysis_run_numbers(run_id: int, results: List[Dict[str, Any]]):
    """Saves individual number results for an analysis run."""
    if not results:
        return
    conn = get_connection()
    cursor = conn.cursor()
    
    # We'll use a batch insert for performance
    data = []
    for r in results:
        data.append((
            run_id, r['e164'], r['status'], r['total_attempts'],
            r['total_200ok'], r['total_404'], r['total_480'], 
            r['total_487'], r['total_503'], r['avg_secs'],
            r['days_observed'], r['days_without_200ok'], r['from_history']
        ))
    
    cursor.executemany("""
        INSERT INTO analysis_run_numbers (
            analysis_run_id, number_e164, final_status, total_attempts_window,
            total_200ok_window, total_404_window, total_480_window, 
            total_487_window, total_503_window, avg_tot_secs_window,
            days_observed, days_without_200ok, included_from_history
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, data)
    
    conn.commit()
    conn.close()

def get_analysis_runs_history() -> List[Dict[str, Any]]:
    """Returns the history of analysis runs from the database."""
    conn = get_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM analysis_runs 
        ORDER BY created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    
    history = []
    for row in rows:
        history.append(dict(row))
    return history

# Initialize on import
init_db()
