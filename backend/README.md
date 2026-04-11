# Backend de Análisis de CDR (Python)

Este es el backend refactorizado para procesar archivos CSV de gran escala (millones de registros).

## Requisitos

- Python 3.9+
- Pip

## Instalación

1. Instalar dependencias:
   ```bash
   pip install -r requirements.txt
   ```

## Ejecución

1. Iniciar el servidor FastAPI:
   ```bash
   # Desde la carpeta /backend
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
   *Nota: Se recomienda NO usar --reload para análisis de larga duración para evitar reinicios inesperados del proceso.*

## Endpoints

- `POST /analyze`: Sube un archivo CSV y parámetros para análisis.
- `GET /download/{job_id}`: Descarga el archivo CSV resultante.

## Arquitectura

El procesamiento se realiza en "chunks" utilizando `pandas` para evitar cargar todo el archivo en la memoria RAM. Se realizan dos pasadas sobre el archivo:
1. Para encontrar la fecha máxima y validar el formato.
2. Para acumular estadísticas por número (e164) y clasificar.
