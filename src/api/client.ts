/// <reference types="vite/client" />
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
console.log('API_BASE_URL initialized as:', API_BASE_URL);

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface AnalysisStats {
  total_registros: number;
  total_numeros_unicos: number;
  numeros_excluidos_200: number;
  numeros_excluidos_404: number;
  numeros_con_frecuencia_insuficiente: number;
  numeros_match: number;
  numeros_no_match: number;
  filas_invalidas_descartadas: number;
}

export interface JobStatus {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'stopped' | 'cleaned';
  progress_percent: number;
  stage: string;
  message: string;
  stats?: AnalysisStats;
  result_url?: string;
  error?: string;
}

export interface DirectoryStats {
  files: number;
  size_bytes: number;
}

export interface StorageStats {
  temp: DirectoryStats;
  uploads: DirectoryStats;
  backend_temp: DirectoryStats;
  backend_uploads: DirectoryStats;
  results: DirectoryStats;
  total: DirectoryStats;
}

export interface SystemStats {
  total_files: number;
  total_size_bytes: number;
  temp_files: number;
  temp_size_bytes: number;
  result_files: number;
  result_size_bytes: number;
  last_analysis?: string;
  by_module: Record<string, { files: number; size: number }>;
  storage?: StorageStats;
}

export interface CleanupResponse {
  files_deleted: number;
  size_freed_bytes: number;
  remaining_size_bytes?: Record<string, number>;
  message: string;
}

export const startAnalysis = async (
  files: File[], 
  analysisDays: number, 
  minFrequency: number, 
  analysisType: string = 'no_response',
  minTotalFrequency?: number,
  minAvgDailyFrequency?: number
) => {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });
  formData.append('analysis_days', analysisDays.toString());
  formData.append('min_frequency', minFrequency.toString());
  formData.append('analysis_type', analysisType);
  
  if (minTotalFrequency !== undefined) {
    formData.append('min_total_frequency', minTotalFrequency.toString());
  }
  if (minAvgDailyFrequency !== undefined) {
    formData.append('min_avg_daily_frequency', minAvgDailyFrequency.toString());
  }

  const response = await axios.post(`${API_BASE_URL}/analyze`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data as { job_id: string; status: string; analysis_type: string };
};

export const cancelAnalysis = async (jobId: string) => {
  const response = await axios.post(`${API_BASE_URL}/jobs/${jobId}/cancel`);
  return response.data;
};

export const getJobStatus = async (jobId: string) => {
  const response = await axios.get<JobStatus>(`${API_BASE_URL}/jobs/${jobId}`);
  return response.data;
};

export const getDownloadUrl = (jobId: string) => {
  return `${API_BASE_URL}/download/${jobId}`;
};

export const getDetailedDownloadUrl = (jobId: string) => {
  return `${API_BASE_URL}/download_detailed/${jobId}`;
};

export const getPreview = async (jobId: string, type: 'summary' | 'detailed' = 'summary', limit: number = 100) => {
  const response = await axios.get(`${API_BASE_URL}/preview/${jobId}`, {
    params: { type, limit }
  });
  return response.data;
};

export const getSystemStats = async () => {
  const response = await axios.get<SystemStats>(`${API_BASE_URL}/maintenance/stats`);
  return response.data;
};

export const cleanupSystem = async (module?: string, keepLatest: boolean = false) => {
  const response = await axios.post<CleanupResponse>(`${API_BASE_URL}/maintenance/cleanup`, {
    module,
    keep_latest: keepLatest
  });
  return response.data;
};

export const cleanupTemp = async () => {
  const response = await axios.post<CleanupResponse>(`${API_BASE_URL}/maintenance/cleanup/temp`);
  return response.data;
};

export const cleanupUploads = async () => {
  const response = await axios.post<CleanupResponse>(`${API_BASE_URL}/maintenance/cleanup/uploads`);
  return response.data;
};

export const cleanupResults = async () => {
  const response = await axios.post<CleanupResponse>(`${API_BASE_URL}/maintenance/cleanup/results`);
  return response.data;
};

export const cleanupAll = async () => {
  const response = await axios.post<CleanupResponse>(`${API_BASE_URL}/maintenance/cleanup/all`);
  return response.data;
};
