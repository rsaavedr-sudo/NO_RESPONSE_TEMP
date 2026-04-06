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

# Storage directories
APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # backend/
ROOT_DIR = os.path.dirname(APP_DIR) # project root

STORAGE_DIRS = {
    "temp": os.path.join(ROOT_DIR, "temp"),
    "uploads": os.path.join(ROOT_DIR, "uploads"),
    "backend_temp": os.path.join(APP_DIR, "temp"),
    "backend_uploads": os.path.join(APP_DIR, "uploads"),
    "results": os.path.join(APP_DIR, "results")
}

# Ensure directories exist
for d in STORAGE_DIRS.values():
    if not os.path.exists(d):
        os.makedirs(d, exist_ok=True)

# Main temp directory for current job processing
TEMP_DIR = STORAGE_DIRS["backend_temp"]
UPLOADS_DIR = STORAGE_DIRS["backend_uploads"]
RESULTS_DIR = STORAGE_DIRS["results"]

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

def get_dir_stats(directory: str):
    count = 0
    size = 0
    if os.path.exists(directory):
        for filename in os.listdir(directory):
            filepath = os.path.join(directory, filename)
            if os.path.isfile(filepath):
                count += 1
                size += os.path.getsize(filepath)
    return {"files": count, "size_bytes": size}

def get_system_stats():
    storage = {
        "temp": get_dir_stats(STORAGE_DIRS["temp"]),
        "uploads": get_dir_stats(STORAGE_DIRS["uploads"]),
        "backend_temp": get_dir_stats(STORAGE_DIRS["backend_temp"]),
        "backend_uploads": get_dir_stats(STORAGE_DIRS["backend_uploads"]),
        "results": get_dir_stats(STORAGE_DIRS["results"]),
    }
    
    total_files = sum(s["files"] for s in storage.values())
    total_size = sum(s["size_bytes"] for s in storage.values())
    storage["total"] = {"files": total_files, "size_bytes": total_size}
    
    # Module stats (from backend_temp and results)
    by_module = {
        "no_response": {"files": 0, "size": 0},
        "asr": {"files": 0, "size": 0},
        "no_response_validation": {"files": 0, "size": 0},
        "unknown": {"files": 0, "size": 0}
    }
    
    last_analysis = None
    
    # Scan backend_temp and results for module-specific info
    for d in [STORAGE_DIRS["backend_temp"], STORAGE_DIRS["results"]]:
        if not os.path.exists(d): continue
        for filename in os.listdir(d):
            filepath = os.path.join(d, filename)
            if os.path.isfile(filepath):
                try:
                    size = os.path.getsize(filepath)
                    job_id = None
                    if filename.startswith("input_"):
                        parts = filename.split("_")
                        if len(parts) >= 2: job_id = parts[1]
                    elif filename.startswith("result_"):
                        parts = filename.split("_")
                        if len(parts) >= 2: job_id = parts[1].replace(".csv", "").replace("_detailed", "")
                    
                    module = "unknown"
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
                except: pass
                
    return {
        "total_files": total_files,
        "total_size_bytes": total_size,
        "temp_files": storage["backend_temp"]["files"],
        "temp_size_bytes": storage["backend_temp"]["size_bytes"],
        "result_files": storage["results"]["files"],
        "result_size_bytes": storage["results"]["size_bytes"],
        "last_analysis": last_analysis,
        "by_module": by_module,
        "storage": storage
    }

def cleanup_directory(directory: str, max_age_hours: Optional[int] = None, exclude_active: bool = True):
    files_deleted = 0
    size_freed = 0
    
    if not os.path.exists(directory):
        return 0, 0
        
    active_job_files = set()
    if exclude_active:
        active_job_ids = [jid for jid, j in jobs.items() if j["status"] in ["queued", "processing"]]
        for jid in active_job_ids:
            active_job_files.add(f"input_{jid}")
            active_job_files.add(f"result_{jid}")
            
    now = datetime.now()
    
    for filename in os.listdir(directory):
        filepath = os.path.join(directory, filename)
        if not os.path.isfile(filepath):
            continue
            
        # Safety check: don't delete active job files
        is_active = False
        for prefix in active_job_files:
            if filename.startswith(prefix):
                is_active = True
                break
        if is_active:
            continue
            
        # Age check
        if max_age_hours is not None:
            mtime = datetime.fromtimestamp(os.path.getmtime(filepath))
            if now - mtime < timedelta(hours=max_age_hours):
                continue
                
        try:
            size = os.path.getsize(filepath)
            os.remove(filepath)
            files_deleted += 1
            size_freed += size
            
            # Update job status if it was a result file
            if filename.startswith("result_"):
                job_id = filename.split("_")[1].replace(".csv", "").replace("_detailed", "")
                if job_id in jobs:
                    if "_detailed" in filename:
                        jobs[job_id]["detailed_result_path"] = None
                    else:
                        jobs[job_id]["result_path"] = None
                        if jobs[job_id]["status"] == "completed":
                            jobs[job_id]["status"] = "cleaned"
                            jobs[job_id]["message"] = "Los resultados han sido eliminados para liberar espacio."
        except Exception as e:
            logger.error(f"Error deleting {filename}: {e}")
            
    return files_deleted, size_freed

def cleanup_system(module: Optional[str] = None, keep_latest: bool = False, category: str = "all"):
    files_deleted = 0
    size_freed = 0
    
    dirs_to_clean = []
    if category == "temp":
        dirs_to_clean = [STORAGE_DIRS["temp"], STORAGE_DIRS["backend_temp"]]
    elif category == "uploads":
        dirs_to_clean = [STORAGE_DIRS["uploads"], STORAGE_DIRS["backend_uploads"]]
    elif category == "results":
        dirs_to_clean = [STORAGE_DIRS["results"]]
    else: # all
        dirs_to_clean = list(STORAGE_DIRS.values())
        
    for d in dirs_to_clean:
        d_deleted, d_freed = cleanup_directory(d)
        files_deleted += d_deleted
        size_freed += d_freed
            
    return {"files_deleted": files_deleted, "size_freed_bytes": size_freed}

def auto_cleanup():
    """Runs age-based cleanup for all directories."""
    # temp: > 2 hours
    cleanup_directory(STORAGE_DIRS["temp"], max_age_hours=2)
    cleanup_directory(STORAGE_DIRS["backend_temp"], max_age_hours=2)
    
    # uploads: > 24 hours
    cleanup_directory(STORAGE_DIRS["uploads"], max_age_hours=24)
    cleanup_directory(STORAGE_DIRS["backend_uploads"], max_age_hours=24)
    
    # results: > 24 hours
    cleanup_directory(STORAGE_DIRS["results"], max_age_hours=24)

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
        output_path = os.path.join(RESULTS_DIR, output_filename)
        
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
            if job.get("result_path") and os.path.exists(job["result_path"]):
                try:
                    os.remove(job["result_path"])
                except:
                    pass
            # Delete detailed result file if exists
            if job.get("detailed_result_path") and os.path.exists(job["detailed_result_path"]):
                try:
                    os.remove(job["detailed_result_path"])
                except:
                    pass
    
    for job_id in to_delete:
        del jobs[job_id]
