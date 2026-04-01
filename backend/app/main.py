import os
import shutil
import logging
import asyncio
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sse_starlette.sse import EventSourceResponse
from typing import Optional
import json

from .schemas import AnalyzeResponse, JobStatus, AnalysisStats
from .jobs import create_job, run_analysis_task, get_job, TEMP_DIR, jobs

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
    file: UploadFile = File(...),
    analysis_days: int = Form(7),
    min_frequency: int = Form(5)
):
    """
    Starts an asynchronous CDR analysis job.
    """
    job_id = create_job()
    
    # Save uploaded file to temp directory
    input_filename = f"input_{job_id}.csv"
    input_path = os.path.join(TEMP_DIR, input_filename)
    
    try:
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        logger.error(f"Error saving uploaded file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Could not save file: {str(e)}")
    
    # Start background task
    background_tasks.add_task(
        run_analysis_task, 
        job_id=job_id, 
        input_path=input_path, 
        analysis_days=analysis_days, 
        min_frequency=min_frequency
    )
    
    return {"job_id": job_id, "status": "queued"}

@app.get("/jobs/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    """
    Returns the current status of a job.
    """
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Map stats to Pydantic model if exists
    stats = None
    if job["stats"]:
        stats = AnalysisStats(**job["stats"])
    
    return JobStatus(
        job_id=job["job_id"],
        status=job["status"],
        progress_percent=job["progress_percent"],
        stage=job["stage"],
        message=job["message"],
        stats=stats,
        result_url=f"/download/{job_id}" if job["status"] == "completed" else None,
        error=job["error"]
    )

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
                
                # Map stats to dict if exists
                stats_dict = None
                if job["stats"]:
                    stats_dict = job["stats"]
                
                data = {
                    "job_id": job["job_id"],
                    "status": job["status"],
                    "progress_percent": job["progress_percent"],
                    "stage": job["stage"],
                    "message": job["message"],
                    "stats": stats_dict,
                    "error": job["error"],
                    "result_url": f"/download/{job_id}" if job["status"] == "completed" else None
                }
                
                yield {
                    "event": "update",
                    "data": json.dumps(data)
                }
                
                last_progress = job["progress_percent"]
                last_stage = job["stage"]
                
                if job["status"] in ["completed", "failed"]:
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
