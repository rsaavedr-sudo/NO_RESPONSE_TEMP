export const MANDATORY_COLUMNS = ['call_date', 'e164', 'sip_code'];

export const validateColumns = (columns: string[]): { isValid: boolean; missing: string[] } => {
  const missing = MANDATORY_COLUMNS.filter(col => !columns.includes(col));
  return {
    isValid: missing.length === 0,
    missing
  };
};
