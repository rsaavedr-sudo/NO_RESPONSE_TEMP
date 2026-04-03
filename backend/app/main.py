import os
import shutil
import logging
import asyncio
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sse_starlette.sse import EventSourceResponse
from typing import List, Optional
import json

from .schemas import AnalyzeResponse, JobStatus, AnalysisStats, SystemStats, CleanupRequest, CleanupResponse
from .jobs import create_job, run_analysis_task, get_job, TEMP_DIR, jobs, cancel_job, get_system_stats, cleanup_system
from .utils import to_json_safe

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="CDR Analyzer API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    analysis_days: int = Form(7),
    min_frequency: int = Form(5),
    analysis_type: str = Form("no_response"),
    min_total_frequency: Optional[int] = Form(None),
    min_avg_daily_frequency: Optional[float] = Form(None)
):
    """
    Starts an asynchronous CDR analysis job with multiple files.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
        
    job_id = create_job(analysis_type=analysis_type)
    input_paths = []
    
    try:
        for i, file in enumerate(files):
            input_filename = f"input_{job_id}_{i}.csv"
            input_path = os.path.join(TEMP_DIR, input_filename)
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
        analysis_days=analysis_days, 
        min_frequency=min_frequency,
        min_total_frequency=min_total_frequency,
        min_avg_daily_frequency=min_avg_daily_frequency
    )
    
    return {"job_id": job_id, "status": "queued", "analysis_type": analysis_type}

@app.get("/jobs/{job_id}", response_model=JobStatus)
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

@app.get("/download_detailed/{job_id}")
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

@app.get("/preview/{job_id}")
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

@app.post("/jobs/{job_id}/cancel")
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

@app.get("/maintenance/stats", response_model=SystemStats)
async def get_stats():
    return get_system_stats()

@app.post("/maintenance/cleanup", response_model=CleanupResponse)
async def cleanup(request: CleanupRequest):
    result = cleanup_system(module=request.module, keep_latest=request.keep_latest)
    return {
        "files_deleted": result["files_deleted"],
        "size_freed_bytes": result["size_freed_bytes"],
        "message": f"Limpieza completada. Se eliminaron {result['files_deleted']} archivos."
    }

@app.get("/jobs/{job_id}/stream")
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

@app.get("/download/{job_id}")
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

# Optional: Root endpoint to serve frontend if needed
# But we'll use the platform's Node.js server for that.
