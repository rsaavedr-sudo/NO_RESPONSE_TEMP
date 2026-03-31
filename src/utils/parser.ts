import Papa from 'papaparse';
import { CDRRecord } from '../types';

export const parseCSV = (file: File): Promise<{ data: CDRRecord[]; errors: number }> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      delimiter: ';',
      encoding: 'utf-8',
      skipEmptyLines: true,
      complete: (results) => {
        const data: CDRRecord[] = [];
        let errors = 0;

        results.data.forEach((row: any) => {
          // Basic validation of row structure
          if (row.call_date && row.e164 && row.sip_code) {
            data.push(row as CDRRecord);
          } else {
            errors++;
          }
        });

        resolve({ data, errors });
      },
      error: (err) => {
        reject(err);
      }
    });
  });
};

export const parseDate = (dateStr: string): Date | null => {
  try {
    // Format: 2026-03-30 08:00:15.687660
    // Replace space with T to make it ISO-like
    const isoStr = dateStr.replace(' ', 'T');
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
};
