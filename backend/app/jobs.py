import uuid
import threading
import os
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from .analyzer import analyze_cdr_chunked, analyze_asr_chunked, analyze_no_response_validation
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

def get_system_stats():
    total_files = 0
    total_size = 0
    temp_count = 0
    temp_size = 0
    result_count = 0
    result_size = 0
    
    by_module = {
        "no_response": {"files": 0, "size": 0},
        "asr": {"files": 0, "size": 0},
        "no_response_validation": {"files": 0, "size": 0},
        "unknown": {"files": 0, "size": 0}
    }
    
    last_analysis = None
    
    for filename in os.listdir(TEMP_DIR):
        filepath = os.path.join(TEMP_DIR, filename)
        if os.path.isfile(filepath):
            try:
                size = os.path.getsize(filepath)
                total_files += 1
                total_size += size
                
                # Identify module
                module = "unknown"
                job_id = None
                if filename.startswith("input_"):
                    parts = filename.split("_")
                    if len(parts) >= 2:
                        job_id = parts[1]
                    temp_count += 1
                    temp_size += size
                elif filename.startswith("result_"):
                    parts = filename.split("_")
                    if len(parts) >= 2:
                        # result_jobid.csv or result_jobid_detailed.csv
                        job_id = parts[1].replace(".csv", "").replace("_detailed", "")
                    result_count += 1
                    result_size += size
                
                if job_id and job_id in jobs:
                    module = jobs[job_id].get("analysis_type", "unknown")
                    created_at = jobs[job_id].get("created_at")
                    if not last_analysis or (created_at and created_at > last_analysis):
                        last_analysis = created_at
                
                if module in by_module:
                    by_module[module]["files"] += 1
                    by_module[module]["size"] += size
                else:
                    by_module["unknown"]["files"] += 1
                    by_module["unknown"]["size"] += size
            except Exception as e:
                logger.error(f"Error reading file {filename}: {e}")
                
    return {
        "total_files": total_files,
        "total_size_bytes": total_size,
        "temp_files": temp_count,
        "temp_size_bytes": temp_size,
        "result_files": result_count,
        "result_size_bytes": result_size,
        "last_analysis": last_analysis,
        "by_module": by_module
    }

def cleanup_system(module: Optional[str] = None, keep_latest: bool = False):
    # Identify jobs to keep
    active_jobs = [jid for jid, j in jobs.items() if j["status"] in ["queued", "processing"]]
    
    # Identify latest job for each module if keep_latest is True
    latest_jobs = {}
    if keep_latest:
        for jid, j in jobs.items():
            m = j["analysis_type"]
            if m not in latest_jobs or j["created_at"] > jobs[latest_jobs[m]]["created_at"]:
                latest_jobs[m] = jid
                
    files_deleted = 0
    size_freed = 0
    
    for filename in os.listdir(TEMP_DIR):
        filepath = os.path.join(TEMP_DIR, filename)
        if os.path.isfile(filepath):
            try:
                # Extract job_id
                job_id = None
                if filename.startswith("input_"):
                    parts = filename.split("_")
                    if len(parts) >= 2:
                        job_id = parts[1]
                elif filename.startswith("result_"):
                    parts = filename.split("_")
                    if len(parts) >= 2:
                        job_id = parts[1].replace(".csv", "").replace("_detailed", "")
                
                if not job_id:
                    # Generic temp file
                    size = os.path.getsize(filepath)
                    os.remove(filepath)
                    files_deleted += 1
                    size_freed += size
                    continue
                    
                # Check if it should be kept
                if job_id in active_jobs:
                    continue
                    
                job_info = jobs.get(job_id)
                if not job_info:
                    # Job info lost, but file exists. Delete it.
                    size = os.path.getsize(filepath)
                    os.remove(filepath)
                    files_deleted += 1
                    size_freed += size
                    continue
                    
                job_module = job_info["analysis_type"]
                
                # Filter by module if specified
                if module and job_module != module:
                    continue
                    
                # Check keep_latest
                if keep_latest and job_id == latest_jobs.get(job_module):
                    continue
                    
                # Delete it
                size = os.path.getsize(filepath)
                os.remove(filepath)
                files_deleted += 1
                size_freed += size
                
                # Update job status to reflect result is gone
                if filename.startswith("result_"):
                    if "_detailed" in filename:
                        jobs[job_id]["detailed_result_path"] = None
                    else:
                        jobs[job_id]["result_path"] = None
                        jobs[job_id]["status"] = "cleaned"
                        jobs[job_id]["message"] = "Los resultados han sido eliminados para liberar espacio."
            except Exception as e:
                logger.error(f"Error cleaning file {filename}: {e}")
            
    return {"files_deleted": files_deleted, "size_freed_bytes": size_freed}

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
        
        # Check if detailed result exists
        detailed_path = result_path.replace(".csv", "_detailed.csv")
        if os.path.exists(detailed_path):
            jobs[job_id]["detailed_result_path"] = detailed_path
        else:
            jobs[job_id]["detailed_result_path"] = None

        jobs[job_id]["progress_percent"] = 100
        jobs[job_id]["stage"] = "completed"
        jobs[job_id]["message"] = "Análisis completado exitosamente."

def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    return jobs.get(job_id)

def run_analysis_task(
    job_id: str, 
    input_paths: list[str], 
    analysis_days: int, 
    min_frequency: int,
    min_total_frequency: Optional[int] = None,
    min_avg_daily_frequency: Optional[float] = None
):
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
        elif analysis_type == "no_response_validation":
            # First file is the target list, others are CDRs
            target_path = input_paths[0]
            cdr_paths = input_paths[1:]
            
            # Use defaults if not provided
            min_total = min_total_frequency if min_total_frequency is not None else 30
            min_avg = min_avg_daily_frequency if min_avg_daily_frequency is not None else 5.0
            
            stats = analyze_no_response_validation(
                target_path=target_path,
                cdr_paths=cdr_paths,
                output_path=output_path,
                analysis_days=analysis_days,
                min_total_frequency=min_total,
                min_avg_daily_frequency=min_avg,
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
