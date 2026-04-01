/// <reference types="vite/client" />
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

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
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress_percent: number;
  stage: string;
  message: string;
  stats?: AnalysisStats;
  result_url?: string;
  error?: string;
}

export const startAnalysis = async (file: File, analysisDays: number, minFrequency: number) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('analysis_days', analysisDays.toString());
  formData.append('min_frequency', minFrequency.toString());

  const response = await axios.post(`${API_BASE_URL}/analyze`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data as { job_id: string; status: string };
};

export const getJobStatus = async (jobId: string) => {
  const response = await apiClient.get<JobStatus>(`/jobs/${jobId}`);
  return response.data;
};

export const getDownloadUrl = (jobId: string) => {
  return `${API_BASE_URL}/download/${jobId}`;
};
