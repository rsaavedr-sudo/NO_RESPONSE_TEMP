import streamlit as st
import pandas as pd
from utils.parser import parse_cdr_file
from utils.analyzer import analyze_cdr
from utils.validator import validate_columns

st.set_page_config(page_title="CDR Analyzer", layout="wide")

st.title("📊 CDR Analyzer")
st.markdown("Analizador robusto de Call Detail Records para identificación de NO_RESPONSE_TEMP")

# File Upload
uploaded_file = st.file_uploader("Sube tu archivo CDR (CSV/TXT; UTF-8)", type=["csv", "txt"])

# Parameters
analysis_days = st.number_input("Días de análisis (analysis_days)", min_value=1, value=7, step=1)

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
                    results, output_df = analyze_cdr(df_parsed, analysis_days)
                    
                    # Display Stats
                    st.success("Análisis completado")
                    
                    col0, col1, col2, col3 = st.columns(4)
                    col0.metric("Total Registros Analizados", results['total_registros'])
                    col1.metric("Total Números Únicos", results['total_numeros_unicos'])
                    col2.metric("Excluidos (SIP 200)", results['numeros_excluidos_200'])
                    col3.metric("Excluidos (SIP 404 > 30%)", results['numeros_excluidos_404'])
                    
                    col4, col5, col6 = st.columns(3)
                    col4.metric("Números Analizados", results['numeros_analizados'])
                    col5.metric("Match (NO_RESPONSE_TEMP)", results['numeros_match'])
                    col6.metric("No Match", results['numeros_no_match'])
                    
                    if discarded_rows > 0:
                        st.warning(f"Se descartaron {discarded_rows} filas por errores de parsing de fecha.")
                    
                    # Results and Download
                    st.subheader("NO_RESPONSE_TEMP numbers")
                    st.dataframe(output_df.head(100))
                    
                    csv = output_df.to_csv(index=False).encode('utf-8')
                    st.download_button(
                        label="Descargar CSV",
                        data=csv,
                        file_name=f"cdr_analysis_{pd.Timestamp.now().strftime('%Y%m%d')}.csv",
                        mime="text/csv",
                    )
                    
    except Exception as e:
        st.error(f"Error al procesar el archivo: {str(e)}")
