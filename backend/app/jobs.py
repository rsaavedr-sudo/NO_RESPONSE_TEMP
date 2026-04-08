import uuid
import threading
import os
import logging
import json
import traceback
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from .analyzer import analyze_cdr_chunked, analyze_asr_chunked, analyze_no_response_validation
from .utils import to_json_safe

logger = logging.getLogger(__name__)

# Global job store and lock
jobs: Dict[str, Any] = {}
jobs_lock = threading.Lock()

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

def save_job_metadata(job_id: str):
    """Saves job metadata to a JSON file for persistence."""
    with jobs_lock:
        if job_id not in jobs:
            return
        
        # Create a safe copy for serialization
        try:
            job_data = to_json_safe(jobs[job_id])
        except Exception as e:
            logger.error(f"Error preparing metadata for job {job_id}: {e}")
            return
    
    metadata_path = os.path.join(RESULTS_DIR, f"metadata_{job_id}.json")
    try:
        # Write to a temporary file first then rename for atomicity
        temp_path = f"{metadata_path}.tmp"
        with open(temp_path, "w") as f:
            json.dump(job_data, f, indent=2)
        os.replace(temp_path, metadata_path)
    except Exception as e:
        logger.error(f"Error saving metadata file for job {job_id}: {e}")

def load_history():
    """Loads job history from metadata files in RESULTS_DIR."""
    if not os.path.exists(RESULTS_DIR):
        return
    
    logger.info("Cargando historial de jobs desde disco...")
    loaded_count = 0
    for filename in os.listdir(RESULTS_DIR):
        if filename.startswith("metadata_") and filename.endswith(".json"):
            metadata_path = os.path.join(RESULTS_DIR, filename)
            try:
                with open(metadata_path, "r") as f:
                    job_data = json.load(f)
                    job_id = job_data.get("job_id")
                    if job_id:
                        # Convert ISO string back to datetime
                        if job_data.get("created_at"):
                            job_data["created_at"] = datetime.fromisoformat(job_data["created_at"])
                        if job_data.get("last_update"):
                            job_data["last_update"] = datetime.fromisoformat(job_data["last_update"])
                        
                        # Convert logs timestamps back
                        if "logs" in job_data:
                            for log in job_data["logs"]:
                                if isinstance(log.get("timestamp"), str):
                                    log["timestamp"] = datetime.fromisoformat(log["timestamp"])
                        
                        # If job was reloaded as "processing" or "queued", mark it as "interrupted"
                        # because the thread that was running it is gone.
                        if job_data.get("status") in ["processing", "queued"]:
                            job_data["status"] = "failed"
                            job_data["stage"] = "interrupted"
                            job_data["message"] = "Proceso interrumpido por reinicio del servidor."
                            job_data["error"] = "Server restart"
                        
                        with jobs_lock:
                            jobs[job_id] = job_data
                        loaded_count += 1
            except Exception as e:
                logger.error(f"Error loading metadata from {filename}: {e}")
    logger.info(f"Historial cargado: {loaded_count} jobs.")

# Load history on module import
load_history()

class CancellationException(Exception):
    """Exception raised when a job is cancelled by the user."""
    pass

def create_job(analysis_type: str = "no_response") -> str:
    job_id = str(uuid.uuid4())
    now = datetime.utcnow()
    job_data = {
        "job_id": job_id,
        "analysis_type": analysis_type,
        "status": "queued",
        "progress_percent": 0,
        "stage": "queued",
        "message": "Job en cola...",
        "stats": None,
        "error": None,
        "result_path": None,
        "created_at": now,
        "last_update": now,
        "is_cancelled": False,
        "logs": [
            {
                "timestamp": now,
                "level": "INFO",
                "stage": "queued",
                "message": f"Análisis {analysis_type} iniciado y en cola.",
                "details": None,
                "processed_records": None
            }
        ]
    }
    with jobs_lock:
        jobs[job_id] = job_data
    
    logger.info(f"Job creado: {job_id} ({analysis_type})")
    save_job_metadata(job_id)
    return job_id

def add_job_log(job_id: str, level: str, stage: str, message: str, details: Optional[str] = None, processed_records: Optional[int] = None):
    with jobs_lock:
        if job_id not in jobs:
            return
        
        now = datetime.utcnow()
        log_entry = {
            "timestamp": now,
            "level": level,
            "stage": stage,
            "message": message,
            "details": details,
            "processed_records": processed_records
        }
        if "logs" not in jobs[job_id]:
            jobs[job_id]["logs"] = []
        jobs[job_id]["logs"].append(log_entry)
        jobs[job_id]["last_update"] = now
        
        # Limit logs to 5000 entries for persistence
        if len(jobs[job_id]["logs"]) > 5000:
            jobs[job_id]["logs"] = jobs[job_id]["logs"][-5000:]
            
    # Log to system logger as well
    log_msg = f"[{job_id}] [{stage}] {message}"
    if processed_records is not None:
        log_msg += f" (Records: {processed_records})"
        
    if level == "ERROR":
        logger.error(log_msg)
    elif level == "WARNING":
        logger.warning(log_msg)
    else:
        logger.info(log_msg)
        
    # Persist log entry
    save_job_metadata(job_id)

def cancel_job(job_id: str):
    with jobs_lock:
        if job_id in jobs:
            now = datetime.utcnow()
            jobs[job_id]["is_cancelled"] = True
            jobs[job_id]["status"] = "stopped"
            jobs[job_id]["stage"] = "stopped"
            jobs[job_id]["message"] = "Proceso detenido por el usuario"
            jobs[job_id]["last_update"] = now
    
    add_job_log(job_id, "WARNING", "stopped", "Proceso detenido por el usuario")
    logger.info(f"Job {job_id} marked as cancelled")
    save_job_metadata(job_id)

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
                    # Update metadata file
                    save_job_metadata(job_id)
            
            # If metadata file is deleted, remove from memory
            if filename.startswith("metadata_"):
                job_id = filename.replace("metadata_", "").replace(".json", "")
                if job_id in jobs:
                    del jobs[job_id]
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
    
    # results: > 7 days (168 hours)
    cleanup_directory(STORAGE_DIRS["results"], max_age_hours=168)

def check_cancellation(job_id: str):
    if job_id in jobs and jobs[job_id].get("is_cancelled"):
        raise CancellationException("Proceso detenido por el usuario")

def update_job_progress(job_id: str, percent: int, stage: str, message: str, processed_records: Optional[int] = None):
    with jobs_lock:
        if job_id not in jobs:
            return
        
        # Check for cancellation before updating
        if jobs[job_id].get("is_cancelled"):
            raise CancellationException("Proceso detenido por el usuario")
            
        now = datetime.utcnow()
        jobs[job_id]["progress_percent"] = to_json_safe(percent)
        
        old_stage = jobs[job_id].get("stage")
        old_percent = jobs[job_id].get("progress_percent", 0)
        
        jobs[job_id]["stage"] = stage
        jobs[job_id]["message"] = message
        jobs[job_id]["last_update"] = now
        if processed_records is not None:
            jobs[job_id]["processed_records"] = processed_records
        
        if stage == "completed":
            jobs[job_id]["status"] = "completed"
        elif stage == "failed":
            jobs[job_id]["status"] = "failed"
        elif stage == "stopped":
            jobs[job_id]["status"] = "stopped"
        else:
            jobs[job_id]["status"] = "processing"
            
        # Add log for stage transitions or progress milestones
        should_log = old_stage != stage or (percent % 10 == 0 and percent != old_percent)
    
    if should_log:
        add_job_log(job_id, "INFO", stage, message, processed_records=processed_records)
    else:
        # Still save metadata even if no log added, to persist progress
        save_job_metadata(job_id)

def set_job_error(job_id: str, error: str):
    with jobs_lock:
        if job_id in jobs:
            now = datetime.utcnow()
            jobs[job_id]["status"] = "failed"
            jobs[job_id]["error"] = error
            jobs[job_id]["message"] = f"Error: {error}"
            jobs[job_id]["last_update"] = now
    
    add_job_log(job_id, "ERROR", "failed", f"Error crítico: {error}")
    save_job_metadata(job_id)

def set_job_result(job_id: str, stats: Dict[str, Any], result_path: str):
    with jobs_lock:
        if job_id in jobs:
            now = datetime.utcnow()
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
            jobs[job_id]["last_update"] = now
        
    add_job_log(job_id, "INFO", "completed", "Análisis finalizado correctamente. Resultados guardados.")
    save_job_metadata(job_id)

def delete_job(job_id: str):
    """Deletes all files associated with a job and removes it from memory."""
    if job_id not in jobs:
        return False
    
    # Delete result files
    job = jobs[job_id]
    paths = [
        job.get("result_path"),
        job.get("detailed_result_path"),
        os.path.join(RESULTS_DIR, f"metadata_{job_id}.json")
    ]
    
    for path in paths:
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except Exception as e:
                logger.error(f"Error deleting file {path}: {e}")
    
    if job_id in jobs:
        del jobs[job_id]
    return True

def get_history() -> List[Dict[str, Any]]:
    """Returns a list of completed or failed jobs."""
    history = []
    for job_id, job in jobs.items():
        if job["status"] in ["completed", "failed", "cleaned"]:
            history.append(job)
    
    # Sort by date descending
    history.sort(key=lambda x: x["created_at"], reverse=True)
    return history

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
    logger.info(f"Task iniciada para job {job_id}")
    try:
        with jobs_lock:
            job = jobs.get(job_id)
            if not job:
                logger.error(f"Job {job_id} no encontrado al iniciar task")
                return
            analysis_type = job.get("analysis_type", "no_response")
            # Set status to processing immediately
            job["status"] = "processing"
            job["stage"] = "starting"
            job["message"] = "Iniciando procesamiento..."
            job["last_update"] = datetime.utcnow()
        
        logger.info(f"Job {job_id} transicionado a 'processing'")
        add_job_log(job_id, "INFO", "processing", f"Iniciando procesamiento de tarea: {analysis_type}")
        add_job_log(job_id, "INFO", "processing", f"Archivos a procesar: {', '.join([os.path.basename(p) for p in input_paths])}")
        
        output_filename = f"result_{job_id}.csv"
        output_path = os.path.join(RESULTS_DIR, output_filename)
        
        def progress_callback(percent, stage, message, processed_records=None):
            update_job_progress(job_id, percent, stage, message, processed_records=processed_records)
            
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
        logger.info(f"Task finalizada con éxito para job {job_id}")
        
    except CancellationException:
        logger.info(f"Job {job_id} was cancelled by the user.")
        update_job_progress(job_id, 0, "stopped", "Proceso detenido por el usuario")
    except Exception as e:
        stack_trace = traceback.format_exc()
        logger.exception(f"Error processing job {job_id}")
        add_job_log(job_id, "ERROR", "failed", f"Excepción completa: {str(e)}", details=stack_trace)
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
    now = datetime.utcnow()
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
