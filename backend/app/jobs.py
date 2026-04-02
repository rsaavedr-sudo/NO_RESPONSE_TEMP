import uuid
import threading
import os
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from .analyzer import analyze_cdr_chunked, analyze_asr_chunked
from .utils import to_json_safe

logger = logging.getLogger(__name__)

# Global job store
# job_id -> {status, progress, stage, message, stats, error, result_path, created_at}
jobs: Dict[str, Any] = {}

# Temp directory for uploads and results
TEMP_DIR = os.getenv("TEMP_DIR", "temp")
if not os.path.exists(TEMP_DIR):
    os.makedirs(TEMP_DIR)

class CancellationException(Exception):
    """Exception raised when a job is cancelled by the user."""
    pass

def create_job(analysis_type: str = "no_response") -> str:
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "job_id": job_id,
        "analysis_type": analysis_type,
        "status": "queued",
        "progress_percent": 0,
        "stage": "queued",
        "message": "Job en cola...",
        "stats": None,
        "error": None,
        "result_path": None,
        "created_at": datetime.now(),
        "is_cancelled": False
    }
    return job_id

def cancel_job(job_id: str):
    if job_id in jobs:
        jobs[job_id]["is_cancelled"] = True
        jobs[job_id]["status"] = "stopped"
        jobs[job_id]["stage"] = "stopped"
        jobs[job_id]["message"] = "Proceso detenido por el usuario"
        logger.info(f"Job {job_id} marked as cancelled")

def check_cancellation(job_id: str):
    if job_id in jobs and jobs[job_id].get("is_cancelled"):
        raise CancellationException("Proceso detenido por el usuario")

def update_job_progress(job_id: str, percent: int, stage: str, message: str):
    if job_id in jobs:
        # Check for cancellation before updating
        if jobs[job_id].get("is_cancelled"):
            raise CancellationException("Proceso detenido por el usuario")
            
        jobs[job_id]["progress_percent"] = to_json_safe(percent)
        jobs[job_id]["stage"] = stage
        jobs[job_id]["message"] = message
        if stage == "completed":
            jobs[job_id]["status"] = "completed"
        elif stage == "failed":
            jobs[job_id]["status"] = "failed"
        elif stage == "stopped":
            jobs[job_id]["status"] = "stopped"
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

def run_analysis_task(job_id: str, input_paths: list[str], analysis_days: int, min_frequency: int):
    try:
        job = jobs.get(job_id)
        analysis_type = job.get("analysis_type", "no_response")
        
        output_filename = f"result_{job_id}.csv"
        output_path = os.path.join(TEMP_DIR, output_filename)
        
        def progress_callback(percent, stage, message):
            update_job_progress(job_id, percent, stage, message)
            
        def check_cancel():
            check_cancellation(job_id)
            
        if analysis_type == "no_response":
            stats = analyze_cdr_chunked(
                input_paths=input_paths,
                output_path=output_path,
                analysis_days=analysis_days,
                min_frequency=min_frequency,
                progress_callback=progress_callback,
                check_cancellation=check_cancel
            )
        elif analysis_type == "asr":
            stats = analyze_asr_chunked(
                input_paths=input_paths,
                output_path=output_path,
                analysis_days=analysis_days,
                progress_callback=progress_callback,
                check_cancellation=check_cancel
            )
        else:
            raise ValueError(f"Unknown analysis type: {analysis_type}")
        
        set_job_result(job_id, stats, output_path)
        
    except CancellationException:
        logger.info(f"Job {job_id} was cancelled by the user.")
        # Status is already updated by cancel_job, but we ensure it here
        update_job_progress(job_id, 0, "stopped", "Proceso detenido por el usuario")
    except Exception as e:
        logger.exception(f"Error processing job {job_id}")
        set_job_error(job_id, str(e))
    finally:
        # Clean up input files
        for path in input_paths:
            if os.path.exists(path):
                try:
                    os.remove(path)
                except:
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
