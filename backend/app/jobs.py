import uuid
import threading
import os
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from .analyzer import analyze_cdr_chunked
from .utils import to_json_safe

logger = logging.getLogger(__name__)

# Global job store
# job_id -> {status, progress, stage, message, stats, error, result_path, created_at}
jobs: Dict[str, Any] = {}

# Temp directory for uploads and results
TEMP_DIR = os.getenv("TEMP_DIR", "temp")
if not os.path.exists(TEMP_DIR):
    os.makedirs(TEMP_DIR)

def create_job() -> str:
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "progress_percent": 0,
        "stage": "queued",
        "message": "Job en cola...",
        "stats": None,
        "error": None,
        "result_path": None,
        "created_at": datetime.now()
    }
    return job_id

def update_job_progress(job_id: str, percent: int, stage: str, message: str):
    if job_id in jobs:
        jobs[job_id]["progress_percent"] = to_json_safe(percent)
        jobs[job_id]["stage"] = stage
        jobs[job_id]["message"] = message
        if stage == "completed":
            jobs[job_id]["status"] = "completed"
        elif stage == "failed":
            jobs[job_id]["status"] = "failed"
        else:
            jobs[job_id]["status"] = "processing"

def set_job_error(job_id: str, error: str):
    if job_id in jobs:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = error
        jobs[job_id]["message"] = f"Error: {error}"

def set_job_result(job_id: str, stats: Dict[str, Any], result_path: str):
    if job_id in jobs:
        jobs[job_id]["status"] = "completed"
        jobs[job_id]["stats"] = to_json_safe(stats)
        jobs[job_id]["result_path"] = result_path
        jobs[job_id]["progress_percent"] = 100
        jobs[job_id]["stage"] = "completed"
        jobs[job_id]["message"] = "Análisis completado exitosamente."

def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    return jobs.get(job_id)

def run_analysis_task(job_id: str, input_path: str, analysis_days: int, min_frequency: int):
    try:
        output_filename = f"result_{job_id}.csv"
        output_path = os.path.join(TEMP_DIR, output_filename)
        
        def progress_callback(percent, stage, message):
            update_job_progress(job_id, percent, stage, message)
            
        stats = analyze_cdr_chunked(
            input_path=input_path,
            output_path=output_path,
            analysis_days=analysis_days,
            min_frequency=min_frequency,
            progress_callback=progress_callback
        )
        
        set_job_result(job_id, stats, output_path)
        
    except Exception as e:
        logger.exception(f"Error processing job {job_id}")
        set_job_error(job_id, str(e))
    finally:
        # We keep the input file for now, but we could delete it if needed
        # os.remove(input_path)
        pass

def cleanup_old_jobs(hours: int = 24):
    """
    Removes old jobs and their files.
    """
    now = datetime.now()
    to_delete = []
    for job_id, job in jobs.items():
        if now - job["created_at"] > timedelta(hours=hours):
            to_delete.append(job_id)
            # Delete result file if exists
            if job["result_path"] and os.path.exists(job["result_path"]):
                try:
                    os.remove(job["result_path"])
                except:
                    pass
    
    for job_id in to_delete:
        del jobs[job_id]
