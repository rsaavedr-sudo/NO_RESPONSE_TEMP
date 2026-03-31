# CDR Analyzer

Herramienta robusta para el análisis de Call Detail Records (CDR) diseñada para identificar números con comportamiento `NO_RESPONSE_TEMP` basándose en reglas de exclusión y filtros temporales.

## 🚀 Características

- **Análisis de CSV:** Soporta archivos CSV con separador `;` y encoding `UTF-8`.
- **Validación de Columnas:** Verifica la existencia de `call_date`, `e164` y `sip_code`.
- **Lógica de Exclusión:**
  - **Regla 1:** Excluye números con al menos un `sip_code = 200`.
  - **Regla 2:** Excluye números con más del 30% de `sip_code = 404`.
- **Filtro Temporal:** Permite definir una ventana de días (`analysis_days`) desde la fecha máxima del dataset.
- **Clasificación:** Identifica números que pasan los filtros y tienen actividad en el periodo.
- **Exportación:** Genera un CSV descargable con los resultados (`e164`, `frequency`).

## 🛠️ Instalación y Ejecución

### Versión Web (React/TypeScript) - Recomendada
Esta versión está optimizada para ejecutarse en este entorno.

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Ejecutar en desarrollo:
   ```bash
   npm run dev
   ```

### Versión Python (Streamlit)
Se incluye el código fuente en la carpeta `python_version/` para su uso en entornos locales con Python 3.10+.

1. Instalar dependencias:
   ```bash
   pip install -r python_version/requirements.txt
   ```
2. Ejecutar:
   ```bash
   streamlit run python_version/app.py
   ```

## 📂 Formato del Archivo de Entrada

El archivo CSV debe tener el siguiente formato:
- **Separador:** `;`
- **Encoding:** `UTF-8`
- **Columnas Requeridas:** `call_date`, `e164`, `sip_code`.
- **Formato de Fecha:** `YYYY-MM-DD HH:MM:SS.microsecond`

## 🧠 Lógica de Negocio

1. **Unidad de Análisis:** Agrupación por `e164`.
2. **Exclusión por Contacto:** Si existe algún registro con `sip_code = 200`, el número se descarta.
3. **Exclusión por Número Inválido:** Si el porcentaje de `sip_code = 404` es mayor al 30%, el número se descarta.
4. **Filtro Temporal:** Se calcula la fecha máxima (`max_date`) y se filtran los registros dentro de `max_date - analysis_days`.
5. **Clasificación Final:** Los números que superan las exclusiones y tienen registros en la ventana temporal se marcan como `NO_RESPONSE_TEMP`.
