/**
 * Utility for formatting dates in the America/Sao_Paulo timezone with pt-BR locale.
 */
export const formatDateTime = (dateString?: string | Date): string => {
  if (!dateString) return 'N/A';
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    // Use Intl.DateTimeFormat for accurate timezone conversion and formatting
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(date);
    const day = parts.find(p => p.type === 'day')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const year = parts.find(p => p.type === 'year')?.value;
    const hour = parts.find(p => p.type === 'hour')?.value;
    const minute = parts.find(p => p.type === 'minute')?.value;
    
    // Capitalize first letter of month and remove trailing dot if present
    const formattedMonth = month 
      ? month.charAt(0).toUpperCase() + month.slice(1).replace('.', '') 
      : '';
    
    return `${day} ${formattedMonth} ${year} · ${hour}:${minute}`;
  } catch (e) {
    return typeof dateString === 'string' ? dateString : 'Error';
  }
};

export const formatTimeOnly = (dateString?: string | Date): string => {
  if (!dateString) return 'N/A';
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(date);
  } catch (e) {
    return 'Error';
  }
};
