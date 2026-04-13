import os
import shutil
import logging
import asyncio
import uuid
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sse_starlette.sse import EventSourceResponse
from typing import List, Optional
from datetime import datetime
import json

from .schemas import (
    AnalyzeResponse, JobStatus, AnalysisStats, SystemStats, 
    CleanupRequest, CleanupResponse, StorageStats,
    ProcessedBatch, DuplicateCheckResponse, DuplicateCheckResult,
    HistoricalAnalysisRequest, HistoricalAnalysisResponse
)
from .jobs import (
    create_job, run_analysis_task, get_job, get_last_job, 
    TEMP_DIR, UPLOADS_DIR, RESULTS_DIR, jobs, cancel_job, 
    get_system_stats, cleanup_system, auto_cleanup, get_history, delete_job
)
from .utils import to_json_safe, parse_float
from .database import get_processed_batches, get_batch_by_hash, get_file_hash, get_historical_analysis_run
from .analyzer import (
    run_historical_no_response_analysis
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="CDR Analyzer API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Background task for periodic cleanup
async def periodic_cleanup():
    while True:
        try:
            auto_cleanup()
            logger.info("Auto-cleanup completed")
        except Exception as e:
            logger.error(f"Error in auto-cleanup: {e}")
        await asyncio.sleep(3600) # Every hour

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(periodic_cleanup())

api_router = APIRouter(prefix="/api")

@api_router.get("/health")
async def health():
    return {"status": "ok", "version": "2.4.0"}

@api_router.get("/maintenance/processed-batches", response_model=List[ProcessedBatch])
async def list_processed_batches():
    """Returns a list of all processed batches."""
    return get_processed_batches()

@api_router.post("/check-duplicates", response_model=DuplicateCheckResponse)
async def check_duplicates(files: List[UploadFile] = File(...)):
    """Checks if uploaded files have already been processed."""
    results = []
    has_duplicates = False
    
    # We need to save them temporarily to calculate hash
    temp_paths = []
    try:
        for file in files:
            temp_path = os.path.join(TEMP_DIR, f"check_{uuid.uuid4()}_{file.filename}")
            temp_paths.append(temp_path)
            with open(temp_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            f_hash = get_file_hash(temp_path)
            existing = get_batch_by_hash(f_hash)
            
            if existing:
                has_duplicates = True
                results.append(DuplicateCheckResult(
                    filename=file.filename,
                    is_duplicate=True,
                    existing_batch=ProcessedBatch(**existing)
                ))
            else:
                results.append(DuplicateCheckResult(
                    filename=file.filename,
                    is_duplicate=False
                ))
    finally:
        # Cleanup temp files
        for path in temp_paths:
            if os.path.exists(path):
                os.remove(path)
                
    return DuplicateCheckResponse(results=results, has_duplicates=has_duplicates)

@api_router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    analysis_days: str = Form("7"),
    min_frequency: str = Form("5"),
    analysis_type: str = Form("no_response"),
    min_total_frequency: Optional[str] = Form(None),
    min_avg_daily_frequency: Optional[str] = Form(None),
    use_history: bool = Form(True),
    history_days: str = Form("30")
):
    """
    Starts an asynchronous CDR analysis job with multiple files.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    
    # Robust parsing of numeric fields
    try:
        days = int(parse_float(analysis_days, "Días de Análisis"))
        min_freq = int(parse_float(min_frequency, "Frecuencia Mínima"))
        min_total = int(parse_float(min_total_frequency, "Min Frequency")) if min_total_frequency else None
        min_avg = parse_float(min_avg_daily_frequency, "Avg Daily Freq") if min_avg_daily_frequency else None
        h_days = int(parse_float(history_days, "Días de Histórico"))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    job_id = create_job(analysis_type=analysis_type)
    
    # Update job with new parameters
    if job_id in jobs:
        jobs[job_id]["use_history"] = use_history
        jobs[job_id]["history_days"] = h_days

    input_paths = []
    
    try:
        for i, file in enumerate(files):
            # Keep original filename for deduplication metadata
            original_filename = file.filename
            input_filename = f"input_{job_id}_{i}.csv"
            input_path = os.path.join(UPLOADS_DIR, input_filename)
            
            # Store original filename in job metadata for later use in analyzer
            if "input_filenames" not in jobs[job_id]:
                jobs[job_id]["input_filenames"] = []
            jobs[job_id]["input_filenames"].append(original_filename)

            input_paths.append(input_path)
            
            with open(input_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
                
    except Exception as e:
        logger.error(f"Error saving uploaded files: {str(e)}")
        # Cleanup any files already saved
        for path in input_paths:
            if os.path.exists(path):
                os.remove(path)
        raise HTTPException(status_code=500, detail=f"Could not save files: {str(e)}")
    
    # Start background task
    background_tasks.add_task(
        run_analysis_task, 
        job_id=job_id, 
        input_paths=input_paths, 
        analysis_days=days, 
        min_frequency=min_freq,
        min_total_frequency=min_total,
        min_avg_daily_frequency=min_avg,
        use_history=use_history,
        history_days=h_days
    )
    
    return {"job_id": job_id, "status": "queued", "analysis_type": analysis_type}

@api_router.get("/jobs/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    """
    Returns the current status of a job.
    """
    logger.info(f"Consultando status do job: {job_id}")
    job = get_job(job_id)
    if not job:
        logger.warning(f"Job não encontrado: {job_id}")
        raise HTTPException(status_code=404, detail="Job not found")
    
    return format_job_status(job)

@api_router.get("/jobs/last/{analysis_type}", response_model=JobStatus)
async def get_last_job_status(analysis_type: str):
    """
    Returns the most recent completed job for a given analysis type, checking memory and DB.
    """
    # 1. Check memory
    job = get_last_job(analysis_type)
    
    # 2. Check DB if no memory job or to find a more recent one
    from .database import get_analysis_runs_history
    db_history = get_analysis_runs_history()
    db_job = next((j for j in db_history if j.get("analysis_type") == analysis_type and j["status"] == "completed"), None)
    
    # Compare and pick the most recent
    final_job = job
    if db_job:
        if not final_job:
            final_job = db_job
        else:
            # Compare created_at
            from .utils import normalize_datetime
            mem_created = normalize_datetime(final_job["created_at"])
            db_created = normalize_datetime(db_job["created_at"])
            
            if db_created > mem_created:
                final_job = db_job
    
    if not final_job:
        raise HTTPException(status_code=404, detail=f"No completed job found for type {analysis_type}")
    
    return format_job_status(final_job)

def format_job_status(job: dict):
    try:
        # Sanitize job data for JSON serialization
        safe_job = to_json_safe(job)
        
        # Normalize result paths from DB if needed
        if "result_file_path" in safe_job and "result_path" not in safe_job:
            safe_job["result_path"] = safe_job["result_file_path"]
        
        # Normalize datetimes
        from .utils import normalize_datetime
        if safe_job.get("created_at"):
            safe_job["created_at"] = normalize_datetime(safe_job["created_at"])
        if safe_job.get("completed_at"):
            safe_job["completed_at"] = normalize_datetime(safe_job["completed_at"])
        if safe_job.get("last_update"):
            safe_job["last_update"] = normalize_datetime(safe_job["last_update"])
        
        # Map stats to Pydantic model if exists
        stats = None
        if safe_job.get("stats"):
            stats = AnalysisStats(**safe_job["stats"])
        elif safe_job.get("summary_json"):
            try:
                summary = json.loads(safe_job["summary_json"])
                stats = AnalysisStats(**summary)
            except:
                pass
        
        # Determine detailed result path
        detailed_path = safe_job.get("detailed_result_path")
        if not detailed_path and safe_job.get("result_path"):
            # Try to infer it with new naming convention: detailed_{job_id}.csv
            results_dir = os.path.dirname(safe_job["result_path"])
            detailed_filename = os.path.basename(safe_job["result_path"]).replace("result_", "detailed_")
            inferred = os.path.join(results_dir, detailed_filename)
            if os.path.exists(inferred):
                detailed_path = inferred

        return JobStatus(
            job_id=safe_job["job_id"],
            status=safe_job["status"],
            analysis_type=safe_job.get("analysis_type", "no_response"),
            progress_percent=safe_job.get("progress_percent", 100 if safe_job["status"] == "completed" else 0),
            stage=safe_job.get("stage", safe_job["status"]),
            message=safe_job.get("message", "Completado" if safe_job["status"] == "completed" else ""),
            stats=stats,
            result_url=f"/api/download/{safe_job['job_id']}" if safe_job["status"] == "completed" else None,
            detailed_result_url=f"/api/download_detailed/{safe_job['job_id']}" if detailed_path else None,
            error=safe_job.get("error"),
            processed_records=safe_job.get("processed_records") or safe_job.get("total_numbers_analyzed"),
            use_history=safe_job.get("use_history", True),
            history_days=safe_job.get("history_days", 30),
            files_skipped=safe_job.get("files_skipped", []),
            days_considered=safe_job.get("days_considered", []),
            logs=safe_job.get("logs", []),
            last_update=safe_job.get("last_update") or safe_job.get("completed_at") or safe_job.get("created_at"),
            created_at=safe_job.get("created_at"),
            completed_at=safe_job.get("completed_at")
        )
    except Exception as e:
        logger.exception(f"Erro ao formatar status do job: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal error processing job status: {str(e)}")

@api_router.get("/download_detailed/{job_id}")
async def download_detailed_result(job_id: str):
    """
    Downloads the detailed result CSV for a completed job.
    """
    job = get_job(job_id)
    
    # If not in memory, check DB
    if not job:
        from .database import get_analysis_runs_history
        db_history = get_analysis_runs_history()
        job = next((j for j in db_history if j["job_id"] == job_id), None)
        if job:
            # Normalize keys
            job["result_path"] = job.get("result_file_path")
            job["detailed_result_path"] = job.get("detailed_result_path")
            
            if not job["detailed_result_path"] and job["result_path"]:
                results_dir = os.path.dirname(job["result_path"])
                detailed_filename = os.path.basename(job["result_path"]).replace("result_", "detailed_")
                inferred = os.path.join(results_dir, detailed_filename)
                if os.path.exists(inferred):
                    job["detailed_result_path"] = inferred
    
    if not job or job["status"] != "completed":
        raise HTTPException(status_code=404, detail="Result not found or job not completed")
    
    detailed_path = job.get("detailed_result_path")
    if not detailed_path and job.get("result_path"):
        # Try to infer it with new naming convention: detailed_{job_id}.csv
        results_dir = os.path.dirname(job["result_path"])
        detailed_filename = os.path.basename(job["result_path"]).replace("result_", "detailed_")
        inferred = os.path.join(results_dir, detailed_filename)
        if os.path.exists(inferred):
            detailed_path = inferred
            
    if not detailed_path or not os.path.exists(detailed_path):
        raise HTTPException(status_code=404, detail="Detailed result file missing")
    
    return FileResponse(
        path=detailed_path,
        filename=f"detalle_cdr_{job_id}.csv",
        media_type="text/csv"
    )

@api_router.get("/preview/{job_id}")
async def preview_result(job_id: str, type: str = "summary", limit: int = 100):
    """
    Returns a preview (first N rows) of the result CSV.
    """
    job = get_job(job_id)
    if not job or job["status"] != "completed":
        raise HTTPException(status_code=404, detail="Result not found or job not completed")
    
    path = job["result_path"] if type == "summary" else job.get("detailed_result_path")
    
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Result file missing")
    
    try:
        df = pd.read_csv(path, sep=';', nrows=limit)
        return df.to_dict(orient="records")
    except Exception as e:
        logger.error(f"Error reading preview: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error reading preview: {str(e)}")

@api_router.post("/jobs/{job_id}/cancel")
async def cancel_analysis(job_id: str):
    """
    Cancels an ongoing analysis job.
    """
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job["status"] not in ["queued", "processing"]:
        return {"status": "error", "message": f"Cannot cancel job in status {job['status']}"}
        
    cancel_job(job_id)
    return {"status": "ok", "message": "Proceso detenido por el usuario"}

@api_router.get("/history", response_model=List[JobStatus])
async def list_history():
    """Returns a list of all completed or failed analyses, merging memory and DB."""
    memory_history = get_history()
    from .database import get_analysis_runs_history
    db_history = get_analysis_runs_history()
    
    seen_job_ids = set()
    combined_history = []
    
    def format_job(job_data):
        safe_job = to_json_safe(job_data)
        
        # Normalize result paths from DB if needed
        if "result_file_path" in safe_job and "result_path" not in safe_job:
            safe_job["result_path"] = safe_job["result_file_path"]
            
        # Normalize datetimes
        from .utils import normalize_datetime
        if safe_job.get("created_at"):
            safe_job["created_at"] = normalize_datetime(safe_job["created_at"])
        if safe_job.get("completed_at"):
            safe_job["completed_at"] = normalize_datetime(safe_job["completed_at"])
        if safe_job.get("last_update"):
            safe_job["last_update"] = normalize_datetime(safe_job["last_update"])
            
        stats = None
        if safe_job.get("stats"):
            stats = AnalysisStats(**safe_job["stats"])
        elif safe_job.get("summary_json"):
            try:
                summary = json.loads(safe_job["summary_json"])
                stats = AnalysisStats(**summary)
            except:
                pass
        
        # Determine detailed result path
        detailed_path = safe_job.get("detailed_result_path")
        if not detailed_path and safe_job.get("result_path"):
            # Try to infer it with new naming convention: detailed_{job_id}.csv
            results_dir = os.path.dirname(safe_job["result_path"])
            detailed_filename = os.path.basename(safe_job["result_path"]).replace("result_", "detailed_")
            inferred = os.path.join(results_dir, detailed_filename)
            if os.path.exists(inferred):
                detailed_path = inferred
        
        return JobStatus(
            job_id=safe_job["job_id"],
            status=safe_job["status"],
            analysis_type=safe_job.get("analysis_type", "no_response"),
            progress_percent=safe_job.get("progress_percent", 100 if safe_job["status"] == "completed" else 0),
            stage=safe_job.get("stage", safe_job["status"]),
            message=safe_job.get("message", "Completado" if safe_job["status"] == "completed" else ""),
            stats=stats,
            result_url=f"/api/download/{safe_job['job_id']}" if safe_job["status"] == "completed" else None,
            detailed_result_url=f"/api/download_detailed/{safe_job['job_id']}" if detailed_path else None,
            error=safe_job.get("error"),
            processed_records=safe_job.get("processed_records") or safe_job.get("total_numbers_analyzed"),
            logs=safe_job.get("logs", []),
            last_update=safe_job.get("last_update") or safe_job.get("completed_at") or safe_job.get("created_at"),
            created_at=safe_job.get("created_at"),
            completed_at=safe_job.get("completed_at")
        )

    for job in memory_history:
        if job["job_id"] not in seen_job_ids:
            combined_history.append(format_job(job))
            seen_job_ids.add(job["job_id"])
            
    for db_job in db_history:
        if db_job["job_id"] not in seen_job_ids:
            combined_history.append(format_job(db_job))
            seen_job_ids.add(db_job["job_id"])
            
    combined_history.sort(key=lambda x: x.created_at, reverse=True)
    return combined_history

@api_router.delete("/history/{job_id}")
async def delete_history_item(job_id: str):
    """Deletes a specific analysis from history."""
    success = delete_job(job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"status": "ok", "message": "Análisis eliminado correctamente"}

@api_router.get("/jobs/{job_id}/logs/download")
async def download_job_logs(job_id: str):
    """
    Downloads the full log of a job as a text file.
    """
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    logs = job.get("logs", [])
    log_lines = []
    for log in logs:
        ts = log["timestamp"]
        if isinstance(ts, datetime):
            ts = ts.strftime("%Y-%m-%d %H:%M:%S")
        line = f"[{ts}] [{log['level']}] [{log['stage']}] {log['message']}"
        if log.get("details"):
            line += f"\nDetails: {log['details']}"
        log_lines.append(line)
    
    content = "\n".join(log_lines)
    
    from fastapi.responses import Response
    return Response(
        content=content,
        media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename=logs_{job_id}.txt"}
    )

@api_router.get("/maintenance/storage", response_model=SystemStats)
async def get_storage_stats():
    """Returns detailed storage information."""
    return get_system_stats()

@api_router.post("/maintenance/cleanup/temp", response_model=CleanupResponse)
async def cleanup_temp():
    """Cleans temporary files."""
    result = cleanup_system(category="temp")
    stats = get_system_stats()
    return {
        "files_deleted": result["files_deleted"],
        "size_freed_bytes": result["size_freed_bytes"],
        "remaining_size_bytes": {k: v["size_bytes"] for k, v in stats["storage"].items()},
        "message": f"Temporales limpiados. Se liberaron {result['size_freed_bytes'] / 1024 / 1024:.2f} MB."
    }

@api_router.post("/maintenance/cleanup/uploads", response_model=CleanupResponse)
async def cleanup_uploads():
    """Cleans uploaded files."""
    result = cleanup_system(category="uploads")
    stats = get_system_stats()
    return {
        "files_deleted": result["files_deleted"],
        "size_freed_bytes": result["size_freed_bytes"],
        "remaining_size_bytes": {k: v["size_bytes"] for k, v in stats["storage"].items()},
        "message": f"Uploads limpiados. Se liberaron {result['size_freed_bytes'] / 1024 / 1024:.2f} MB."
    }

@api_router.post("/maintenance/cleanup/results", response_model=CleanupResponse)
async def cleanup_results():
    """Cleans result files."""
    result = cleanup_system(category="results")
    stats = get_system_stats()
    return {
        "files_deleted": result["files_deleted"],
        "size_freed_bytes": result["size_freed_bytes"],
        "remaining_size_bytes": {k: v["size_bytes"] for k, v in stats["storage"].items()},
        "message": f"Resultados limpiados. Se liberaron {result['size_freed_bytes'] / 1024 / 1024:.2f} MB."
    }

@api_router.post("/maintenance/cleanup/all", response_model=CleanupResponse)
async def cleanup_all():
    """Cleans all safe files."""
    result = cleanup_system(category="all")
    stats = get_system_stats()
    return {
        "files_deleted": result["files_deleted"],
        "size_freed_bytes": result["size_freed_bytes"],
        "remaining_size_bytes": {k: v["size_bytes"] for k, v in stats["storage"].items()},
        "message": f"Limpieza total completada. Se liberaron {result['size_freed_bytes'] / 1024 / 1024:.2f} MB."
    }

@api_router.get("/maintenance/stats", response_model=SystemStats)
async def get_stats():
    return get_system_stats()

@api_router.post("/maintenance/cleanup", response_model=CleanupResponse)
async def cleanup(request: CleanupRequest):
    result = cleanup_system(module=request.module, keep_latest=request.keep_latest)
    stats = get_system_stats()
    return {
        "files_deleted": result["files_deleted"],
        "size_freed_bytes": result["size_freed_bytes"],
        "remaining_size_bytes": {k: v["size_bytes"] for k, v in stats["storage"].items()},
        "message": f"Limpieza completada. Se eliminaron {result['files_deleted']} archivos."
    }

@api_router.get("/jobs/{job_id}/stream")
async def stream_job_status(job_id: str):
    """
    Server-Sent Events endpoint for real-time job updates.
    """
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_generator():
        last_progress = -1
        last_stage = ""
        
        while True:
            job = get_job(job_id)
            if not job:
                break
                
            # Only send update if something changed
            if job["progress_percent"] != last_progress or job["stage"] != last_stage or job["status"] in ["completed", "failed"]:
                
                # Sanitize job data for JSON serialization
                safe_job = to_json_safe(job)
                
                # Map stats to dict if exists
                stats_dict = None
                if safe_job["stats"]:
                    stats_dict = safe_job["stats"]
                
                data = {
                    "job_id": safe_job["job_id"],
                    "status": safe_job["status"],
                    "progress_percent": safe_job["progress_percent"],
                    "stage": safe_job["stage"],
                    "message": safe_job["message"],
                    "stats": stats_dict,
                    "error": safe_job["error"],
                    "processed_records": safe_job.get("processed_records"),
                    "result_url": f"/api/download/{job_id}" if safe_job["status"] == "completed" else None,
                    "detailed_result_url": f"/api/download_detailed/{job_id}" if safe_job.get("detailed_result_path") else None,
                    "logs": safe_job.get("logs", []),
                    "last_update": safe_job.get("last_update") or safe_job.get("created_at"),
                    "created_at": safe_job.get("created_at")
                }
                
                yield {
                    "event": "update",
                    "data": json.dumps(data)
                }
                
                last_progress = safe_job["progress_percent"]
                last_stage = safe_job["stage"]
                
                if safe_job["status"] in ["completed", "failed"]:
                    # Small delay to ensure the client receives the last message before closing
                    await asyncio.sleep(0.5)
                    break
            
            await asyncio.sleep(1) # Poll every second for changes to push to SSE

    return EventSourceResponse(event_generator())

@api_router.get("/download/{job_id}")
async def download_result(job_id: str):
    """
    Downloads the result CSV for a completed job.
    """
    job = get_job(job_id)
    
    # If not in memory, check DB
    if not job:
        from .database import get_analysis_runs_history
        db_history = get_analysis_runs_history()
        job = next((j for j in db_history if j["job_id"] == job_id), None)
        if job:
            # Normalize keys
            job["result_path"] = job.get("result_file_path")
    
    if not job or job["status"] != "completed":
        raise HTTPException(status_code=404, detail="Result not found or job not completed")
    
    path = job.get("result_path")
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Result file missing")
    
    return FileResponse(
        path=path,
        filename=f"analisis_cdr_{job_id}.csv",
        media_type="text/csv"
    )

@api_router.post("/noresponse/historical-analysis", response_model=HistoricalAnalysisResponse)
async def historical_no_response_analysis(request: HistoricalAnalysisRequest):
    """Executes a historical NO_RESPONSE analysis."""
    try:
        summary = run_historical_no_response_analysis(
            request.start_date,
            request.end_date,
            request.max_sip_200,
            request.selected_sip_codes,
            RESULTS_DIR
        )
        return summary
    except Exception as e:
        logger.error(f"Error in historical analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/noresponse/historical-analysis/download/{run_id}/{file_type}")
async def download_historical_csv(run_id: int, file_type: str):
    """Downloads a CSV from a historical analysis run."""
    run = get_historical_analysis_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Analysis run not found")
    
    if file_type == "no_response":
        path = run["no_response_file_path"]
        filename = "no_response.csv"
    elif file_type == "minimum_response":
        path = run["minimum_response_file_path"]
        filename = "minimum_response.csv"
    else:
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    return FileResponse(
        path, 
        media_type="text/csv", 
        filename=filename
    )

@api_router.get("/noresponse/historical-analysis/history")
async def get_historical_analysis_history():
    """Returns the history of historical analysis runs."""
    from .database import get_historical_analysis_runs
    return get_historical_analysis_runs()

app.include_router(api_router)

# Optional: Root endpoint to serve frontend if needed
# But we'll use the platform's Node.js server for that.
