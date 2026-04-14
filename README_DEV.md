# CDR Analyzer - Guía de Desarrollo Estable (v2.4.1.2)

Esta guía detalla cómo configurar y ejecutar el entorno de desarrollo de forma previsible y estable, evitando conflictos de puertos y procesos duplicados.

## 📂 Estructura del Proyecto

- **Frontend (Vite + React):** Ubicado en la raíz del proyecto (`/Users/tzero/projects`).
- **Backend (FastAPI):** Ubicado en la subcarpeta `/backend` (`/Users/tzero/projects/backend`).

## 🚀 Comandos de Arranque

Para evitar errores, **levante cada servicio en una terminal independiente**.

### 1. Backend (Puerto 8000)

```bash
cd /Users/tzero/projects/backend
# Activar entorno virtual si existe
# source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Recomendaciones:**
- **NO usar `--reload`** para análisis de larga duración. El auto-recarga de Uvicorn puede matar procesos de análisis en curso si detecta cambios accidentales en archivos temporales o logs.
- Si necesita depurar cambios en el código, use `--reload` solo en sesiones cortas.

### 2. Frontend (Puerto 3000)

```bash
cd /Users/tzero/projects
npm run dev
```

**Notas:**
- El comando `npm run dev` ahora solo levanta el servidor de desarrollo del frontend (`server.ts`).
- Ya no intenta instalar dependencias de Python ni levantar el backend automáticamente, evitando procesos duplicados y errores de permisos.

## 🛠️ Solución de Problemas Comunes

### Puertos Ocupados
Si recibe un error de "Address already in use":
- Verifique procesos de Python: `ps aux | grep uvicorn`
- Verifique procesos de Node: `ps aux | grep node`
- Mate el proceso persistente: `kill -9 <PID>`

### Análisis Interrumpidos
Si el backend se cierra solo durante un análisis:
- Asegúrese de haber iniciado sin `--reload`.
- Revise los logs en la consola del backend para errores de memoria o timeouts.

## 🔄 Actualización desde GitHub
Al hacer `git pull`, los scripts de arranque se mantendrán consistentes. Solo deberá:
1. Reiniciar el backend si hubo cambios en `/backend`.
2. Reiniciar el frontend si hubo cambios en `/src` o `package.json`.
