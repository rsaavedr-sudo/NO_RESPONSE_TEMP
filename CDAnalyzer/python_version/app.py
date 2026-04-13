import streamlit as st
import pandas as pd
from utils.parser import parse_cdr_file
from utils.analyzer import analyze_cdr
from utils.validator import validate_columns

st.set_page_config(page_title="CDR Analyzer", layout="wide")

# Logo (Top Left)
st.markdown(
    """
    <div style="position: fixed; top: 10px; left: 20px; z-index: 1000; display: flex; align-items: center; gap: 8px;">
        <span style="color: #1f2937; font-weight: bold; font-size: 18px; letter-spacing: -0.5px;">T-Zero</span>
        <span style="color: #16a34a; font-weight: 500; font-size: 14px; letter-spacing: 2px; text-transform: uppercase;">Technology</span>
    </div>
    """,
    unsafe_allow_html=True
)

st.title("📊 CDR Analyzer")
st.markdown("Analizador robusto de Call Detail Records para identificación de NO_RESPONSE_TEMP")

# File Upload
uploaded_file = st.file_uploader("Sube tu archivo CDR (CSV/TXT; UTF-8)", type=["csv", "txt"])

# Parameters
col_p1, col_p2 = st.columns(2)
analysis_days = col_p1.number_input("Días de análisis (analysis_days)", min_value=1, value=7, step=1)
min_frequency = col_p2.number_input("Frecuencia mínima (min_frequency)", min_value=1, value=5, step=1)

if uploaded_file is not None:
    try:
        # Load data
        df = pd.read_csv(uploaded_file, sep=';', encoding='utf-8')
        
        # Validate columns
        is_valid, missing = validate_columns(df.columns)
        if not is_valid:
            st.error(f"Faltan columnas obligatorias: {', '.join(missing)}")
        else:
            if st.button("PROCESAR ARCHIVO"):
                with st.spinner("Procesando..."):
                    # Parse and Analyze
                    df_parsed, discarded_rows = parse_cdr_file(df)
                    results, output_df = analyze_cdr(df_parsed, analysis_days, min_frequency)
                    
                    # Display Stats
                    st.success("Análisis completado")
                    
                    col0, col1, col2, col3 = st.columns(4)
                    col0.metric("Total Registros Analizados", results['total_registros'])
                    col1.metric("Total Números Únicos", results['total_numeros_unicos'])
                    col2.metric("Excluidos (SIP 200)", results['numeros_excluidos_200'])
                    col3.metric("Excluidos (SIP 404 > 30%)", results['numeros_excluidos_404'])
                    
                    col4, col5, col6, col7 = st.columns(4)
                    col4.metric("Frecuencia Insuficiente", results['numeros_con_frecuencia_insuficiente'])
                    col5.metric("Números Analizados", results['numeros_analizados'])
                    col6.metric("Match (NO_RESPONSE_TEMP)", results['numeros_match'])
                    col7.metric("No Match", results['numeros_no_match'])
                    
                    if discarded_rows > 0:
                        st.warning(f"Se descartaron {discarded_rows} filas por errores de parsing de fecha.")
                    
                    # Results and Download
                    st.subheader("Analysis Results")
                    
                    # Format for display
                    display_df = output_df.copy()
                    display_df['pct_404'] = (display_df['pct_404'] * 100).round(1).astype(str) + '%'
                    
                    st.dataframe(display_df.head(100))
                    
                    # Prepare CSV for download
                    csv_df = output_df.copy()
                    csv_df['pct_404'] = (csv_df['pct_404'] * 100).round(2).astype(str) + '%'
                    csv_df['analysis_days'] = analysis_days
                    csv_df['min_frequency'] = min_frequency
                    
                    csv = csv_df.to_csv(index=False).encode('utf-8')
                    st.download_button(
                        label="Descargar CSV",
                        data=csv,
                        file_name=f"cdr_analysis_{pd.Timestamp.now().strftime('%Y%m%d')}.csv",
                        mime="text/csv",
                    )
                    
    except Exception as e:
        st.error(f"Error al procesar el archivo: {str(e)}")
