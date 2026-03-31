import { subDays, isAfter, isBefore, isEqual } from 'date-fns';
import { CDRRecord, AnalysisResult } from '../types';
import { parseDate } from './parser';

const isSipCode = (recordSip: string, targetSip: string): boolean => {
  if (!recordSip) return false;
  
  const cleanSip = recordSip.toString().trim().toLowerCase();
  const target = targetSip.toString();

  // Direct match
  if (cleanSip === target) return true;

  // Hex match: if cleanSip is hex (e.g. "c8" for 200)
  try {
    const hexVal = parseInt(cleanSip, 16);
    const targetVal = parseInt(target, 10);
    if (!isNaN(hexVal) && hexVal === targetVal) return true;
  } catch {}

  // Decimal match
  try {
    const decVal = parseInt(cleanSip, 10);
    const targetVal = parseInt(target, 10);
    if (!isNaN(decVal) && decVal === targetVal) return true;
  } catch {}

  return false;
};

export const analyzeCDR = (data: CDRRecord[], analysisDays: number): AnalysisResult => {
  const groupedByE164 = new Map<string, CDRRecord[]>();
  let discardedRows = 0;

  // Grouping and basic date parsing
  data.forEach(record => {
    const date = parseDate(record.call_date);
    if (!date) {
      discardedRows++;
      return;
    }
    
    // Use original e164 without any modification
    const e164 = record.e164?.toString() || '';

    const list = groupedByE164.get(e164) || [];
    list.push(record);
    groupedByE164.set(e164, list);
  });

  // Find max date in the entire dataset
  let maxDate: Date | null = null;
  data.forEach(record => {
    const date = parseDate(record.call_date);
    if (date) {
      if (!maxDate || date > maxDate) {
        maxDate = date;
      }
    }
  });

  if (!maxDate) {
    return {
      total_registros: data.length,
      total_numeros_unicos: 0,
      numeros_excluidos_200: 0,
      numeros_excluidos_404: 0,
      numeros_analizados: 0,
      numeros_match: 0,
      numeros_no_match: 0,
      discarded_rows: discardedRows,
      output_data: []
    };
  }

  const cutoffDate = subDays(maxDate, analysisDays);

  let totalNumerosUnicos = groupedByE164.size;
  let excluded200 = 0;
  let excluded404 = 0;
  let matchCount = 0;
  let noMatchCount = 0;
  const outputData: { e164: string; frequency: number }[] = [];

  groupedByE164.forEach((records, e164) => {
    // Rule 1: Exclusion by 200
    const has200 = records.some(r => isSipCode(r.sip_code, '200'));
    if (has200) {
      excluded200++;
      return;
    }

    // Rule 2: Exclusion by 404 percentage
    const count404 = records.filter(r => isSipCode(r.sip_code, '404')).length;
    const pct404 = count404 / records.length;
    if (pct404 > 0.30) {
      excluded404++;
      return;
    }

    // Rule 3: Valid Universe (Candidate)
    // Rule 4: Filter records by time window
    const recordsInWindow = records.filter(r => {
      const date = parseDate(r.call_date);
      return date && (isAfter(date, cutoffDate) || isEqual(date, cutoffDate));
    });

    // Rule 5: Classification
    if (recordsInWindow.length > 4) {
      matchCount++;
      outputData.push({
        e164,
        frequency: recordsInWindow.length
      });
    } else {
      noMatchCount++;
    }
  });

  return {
    total_registros: data.length,
    total_numeros_unicos: totalNumerosUnicos,
    numeros_excluidos_200: excluded200,
    numeros_excluidos_404: excluded404,
    numeros_analizados: totalNumerosUnicos - excluded200 - excluded404,
    numeros_match: matchCount,
    numeros_no_match: noMatchCount,
    discarded_rows: discardedRows,
    output_data: outputData
  };
};
