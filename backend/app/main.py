import os
import shutil
import logging
import asyncio
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sse_starlette.sse import EventSourceResponse
from typing import List, Optional
import json

from .schemas import AnalyzeResponse, JobStatus, AnalysisStats, SystemStats, CleanupRequest, CleanupResponse, StorageStats
from .jobs import create_job, run_analysis_task, get_job, TEMP_DIR, UPLOADS_DIR, RESULTS_DIR, jobs, cancel_job, get_system_stats, cleanup_system, auto_cleanup, get_history, delete_job
from .utils import to_json_safe, parse_float

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="CDR Analyzer API")

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

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")

@api_router.get("/health")
async def health():
    return {"status": "ok", "version": "2.3.0"}

@api_router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    analysis_days: str = Form("7"),
    min_frequency: str = Form("5"),
    analysis_type: str = Form("no_response"),
    min_total_frequency: Optional[str] = Form(None),
    min_avg_daily_frequency: Optional[str] = Form(None)
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
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    job_id = create_job(analysis_type=analysis_type)
    input_paths = []
    
    try:
        for i, file in enumerate(files):
            input_filename = f"input_{job_id}_{i}.csv"
            input_path = os.path.join(UPLOADS_DIR, input_filename)
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
        min_avg_daily_frequency=min_avg
    )
    
    return {"job_id": job_id, "status": "queued", "analysis_type": analysis_type}

@api_router.get("/jobs/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    """
    Returns the current status of a job.
    """
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Sanitize job data for JSON serialization
    safe_job = to_json_safe(job)
    
    # Map stats to Pydantic model if exists
    stats = None
    if safe_job["stats"]:
        stats = AnalysisStats(**safe_job["stats"])
    
    return JobStatus(
        job_id=safe_job["job_id"],
        status=safe_job["status"],
        analysis_type=safe_job.get("analysis_type", "no_response"),
        progress_percent=safe_job["progress_percent"],
        stage=safe_job["stage"],
        message=safe_job["message"],
        stats=stats,
        result_url=f"/download/{job_id}" if safe_job["status"] == "completed" else None,
        detailed_result_url=f"/download_detailed/{job_id}" if safe_job.get("detailed_result_path") else None,
        error=safe_job["error"]
    )

@api_router.get("/download_detailed/{job_id}")
async def download_detailed_result(job_id: str):
    """
    Downloads the detailed result CSV for a completed job.
    """
    job = get_job(job_id)
    if not job or job["status"] != "completed":
        raise HTTPException(status_code=404, detail="Result not found or job not completed")
    
    detailed_path = job.get("detailed_result_path")
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
    """Returns a list of all completed or failed analyses."""
    history = get_history()
    safe_history = []
    for job in history:
        # Sanitize job data
        safe_job = to_json_safe(job)
        stats = None
        if safe_job.get("stats"):
            stats = AnalysisStats(**safe_job["stats"])
        
        safe_history.append(JobStatus(
            job_id=safe_job["job_id"],
            status=safe_job["status"],
            analysis_type=safe_job.get("analysis_type", "no_response"),
            progress_percent=safe_job["progress_percent"],
            stage=safe_job["stage"],
            message=safe_job["message"],
            stats=stats,
            result_url=f"/download/{safe_job['job_id']}" if safe_job["status"] == "completed" else None,
            detailed_result_url=f"/download_detailed/{safe_job['job_id']}" if safe_job.get("detailed_result_path") else None,
            error=safe_job.get("error")
        ))
    return safe_history

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
                    "result_url": f"/download/{job_id}" if safe_job["status"] == "completed" else None
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
    if not job or job["status"] != "completed":
        raise HTTPException(status_code=404, detail="Result not found or job not completed")
    
    if not job["result_path"] or not os.path.exists(job["result_path"]):
        raise HTTPException(status_code=404, detail="Result file missing")
    
    return FileResponse(
        path=job["result_path"],
        filename=f"analisis_cdr_{job_id}.csv",
        media_type="text/csv"
    )

app.include_router(api_router)

# Optional: Root endpoint to serve frontend if needed
# But we'll use the platform's Node.js server for that.
