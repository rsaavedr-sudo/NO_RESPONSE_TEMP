from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os
import shutil
from .analyzer import analyze_cdr_file
from .schemas import AnalysisResponse, AnalysisStats

app = FastAPI(title="CDR Analysis API")

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_DIR = "temp"
os.makedirs(TEMP_DIR, exist_ok=True)

@app.get("/api/health")
async def health():
    return {"status": "ok"}

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze(
    file: UploadFile = File(...),
    analysis_days: int = Form(30),
    min_frequency: int = Form(5)
):
    # Save uploaded file temporarily
    file_path = os.path.join(TEMP_DIR, f"upload_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        summary, job_id = analyze_cdr_file(file_path, analysis_days, min_frequency)
        
        if summary is None:
            raise HTTPException(status_code=400, detail="No valid dates found in CSV")
            
        return AnalysisResponse(
            job_id=job_id,
            stats=AnalysisStats(**summary)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up uploaded file
        if os.path.exists(file_path):
            os.remove(file_path)

@app.get("/download/{job_id}")
async def download(job_id: str):
    file_path = os.path.join(TEMP_DIR, f"results_{job_id}.csv")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Result file not found")
        
    return FileResponse(
        path=file_path,
        filename=f"cdr_analysis_results_{job_id}.csv",
        media_type="text/csv"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000)
