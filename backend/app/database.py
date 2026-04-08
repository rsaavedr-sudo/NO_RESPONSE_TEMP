import sqlite3
import os
import logging
import hashlib
from datetime import datetime
from pathlib import Path
import pandas as pd
from typing import List, Dict, Any, Optional

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
    
    # Table for daily aggregated stats per number
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_stats (
            e164 TEXT,
            date TEXT,
            total_intentos INTEGER DEFAULT 0,
            total_200ok INTEGER DEFAULT 0,
            total_404 INTEGER DEFAULT 0,
            total_480 INTEGER DEFAULT 0,
            total_487 INTEGER DEFAULT 0,
            total_503 INTEGER DEFAULT 0,
            otros_sip_codes INTEGER DEFAULT 0,
            total_secs REAL DEFAULT 0,
            max_secs REAL DEFAULT 0,
            min_secs REAL DEFAULT 0,
            created_at TEXT,
            updated_at TEXT,
            PRIMARY KEY (e164, date)
        )
    """)
    
    # Table to track processed files for deduplication
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS processed_files (
            filename TEXT PRIMARY KEY,
            file_hash TEXT,
            start_date TEXT,
            end_date TEXT,
            ingested_at TEXT
        )
    """)
    
    conn.commit()
    conn.close()
    logger.info(f"Database initialized at {DB_PATH}")

def get_file_hash(file_path: str) -> str:
    """Calculates SHA256 hash of a file."""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        # Read in chunks to handle large files
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def is_file_processed(filename: str, file_path: Optional[str] = None) -> bool:
    """Checks if a file has already been processed by name or hash."""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Check by filename first
    cursor.execute("SELECT file_hash FROM processed_files WHERE filename = ?", (filename,))
    row = cursor.fetchone()
    
    if row:
        conn.close()
        return True
    
    # If file_path provided, check by hash
    if file_path:
        f_hash = get_file_hash(file_path)
        cursor.execute("SELECT filename FROM processed_files WHERE file_hash = ?", (f_hash,))
        row = cursor.fetchone()
        if row:
            conn.close()
            return True
            
    conn.close()
    return False

def register_processed_file(filename: str, file_hash: str, start_date: str, end_date: str):
    """Registers a file as processed."""
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    
    cursor.execute("""
        INSERT OR REPLACE INTO processed_files (filename, file_hash, start_date, end_date, ingested_at)
        VALUES (?, ?, ?, ?, ?)
    """, (filename, file_hash, start_date, end_date, now))
    
    conn.commit()
    conn.close()

def save_daily_stats(df: pd.DataFrame):
    """
    Saves or updates daily stats from a DataFrame.
    DataFrame must have columns: e164, date, total_intentos, total_200ok, etc.
    """
    if df.empty:
        return
        
    conn = get_connection()
    now = datetime.now().isoformat()
    
    # We use a temporary table to perform an upsert (INSERT OR REPLACE)
    # or we can just iterate if the volume is manageable. 
    # For better performance with large DataFrames, we'll use to_sql with a temp table.
    
    try:
        # Add timestamps
        df['updated_at'] = now
        
        # For new records, we need created_at. 
        # This is tricky with INSERT OR REPLACE because it overwrites created_at if we just pass it.
        # We'll use a manual loop for now to be safe with the logic, 
        # but in a real high-volume app we'd use a proper SQL UPSERT.
        
        cursor = conn.cursor()
        for _, row in df.iterrows():
            cursor.execute("""
                INSERT INTO daily_stats (
                    e164, date, total_intentos, total_200ok, total_404, 
                    total_480, total_487, total_503, otros_sip_codes, 
                    total_secs, max_secs, min_secs, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(e164, date) DO UPDATE SET
                    total_intentos = total_intentos + excluded.total_intentos,
                    total_200ok = total_200ok + excluded.total_200ok,
                    total_404 = total_404 + excluded.total_404,
                    total_480 = total_480 + excluded.total_480,
                    total_487 = total_487 + excluded.total_487,
                    total_503 = total_503 + excluded.total_503,
                    otros_sip_codes = otros_sip_codes + excluded.otros_sip_codes,
                    total_secs = total_secs + excluded.total_secs,
                    max_secs = MAX(max_secs, excluded.max_secs),
                    min_secs = MIN(min_secs, excluded.min_secs),
                    updated_at = excluded.updated_at
            """, (
                row['e164'], row['date'], row['total_intentos'], row['total_200ok'], 
                row['total_404'], row['total_480'], row['total_487'], row['total_503'], 
                row['otros_sip_codes'], row['total_secs'], row['max_secs'], row['min_secs'], 
                now, now
            ))
        
        conn.commit()
    except Exception as e:
        logger.error(f"Error saving daily stats: {e}")
        conn.rollback()
    finally:
        conn.close()

def get_historical_stats(start_date: str, end_date: str) -> pd.DataFrame:
    """Retrieves aggregated stats for a date range."""
    conn = get_connection()
    query = """
        SELECT 
            e164,
            SUM(total_intentos) as total_intentos,
            SUM(total_200ok) as total_200ok,
            SUM(total_404) as total_404,
            SUM(total_480) as total_480,
            SUM(total_487) as total_487,
            SUM(total_503) as total_503,
            SUM(otros_sip_codes) as otros_sip_codes,
            SUM(total_secs) as total_secs,
            MAX(max_secs) as max_secs,
            MIN(min_secs) as min_secs,
            COUNT(DISTINCT date) as dias_con_actividad
        FROM daily_stats
        WHERE date >= ? AND date <= ?
        GROUP BY e164
    """
    df = pd.read_sql_query(query, conn, params=(start_date, end_date))
    conn.close()
    return df

# Initialize on import
init_db()
