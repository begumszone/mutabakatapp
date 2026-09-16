import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import type { ParsedFile, ParsedSheet, ParsedWorkbook, RawRow } from '../types';
import { detectHeaderRowIndex, type Cell } from './detectHeaderRow';

export class FileParseError extends Error {}

function normalizeCell(value: unknown): Cell {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') {
    // Rich text, formula results, or dates
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    const asAny = value as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (asAny.richText) return asAny.richText.map((r) => r.text).join('');
    if (typeof asAny.result === 'number' || typeof asAny.result === 'string') return asAny.result;
    if (typeof asAny.text === 'string') return asAny.text;
    return String(value);
  }
  return value as Cell;
}

/** Gives every column a usable, unique name -- blank headers become "Column D" rather than "". */
function nameHeaders(headerRow: Cell[], width: number): string[] {
  const seen = new Map<string, number>();
  const names: string[] = [];
  for (let i = 0; i < width; i++) {
    let name = String(headerRow[i] ?? '').trim();
    if (!name) name = `Column ${columnLetter(i)}`;
    const used = seen.get(name) ?? 0;
    seen.set(name, used + 1);
    names.push(used === 0 ? name : `${name} (${used + 1})`);
  }
  return names;
}

function columnLetter(index: number): string {
  let n = index;
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

function makeSheet(name: string, grid: Cell[][]): ParsedSheet {
  const trimmed = grid.filter((row) => row.some((c) => c !== null && String(c).trim() !== ''));
  return {
    name,
    grid: trimmed,
    suggestedHeaderRow: trimmed.length > 0 ? detectHeaderRowIndex(trimmed) : 0,
  };
}

/**
 * Builds the header/row view of one sheet, reading the header from
 * `headerRowIndex` and treating everything below it as data. Kept separate
 * from parsing so the user can correct the header row without re-reading
 * the file.
 */
export function sheetToParsedFile(
  workbook: ParsedWorkbook,
  sheetIndex: number,
  headerRowIndex: number,
): ParsedFile {
  const sheet = workbook.sheets[sheetIndex];
  if (!sheet) throw new FileParseError('That sheet is no longer available.');

  const grid = sheet.grid;
  const headerRow = grid[headerRowIndex] ?? [];
  const width = Math.max(headerRow.length, ...grid.slice(headerRowIndex).map((r) => r.length), 1);
  const headers = nameHeaders(headerRow, width);

  const rows: RawRow[] = grid
    .slice(headerRowIndex + 1)
    .filter((row) => row.some((cell) => cell !== null && String(cell).trim() !== ''))
    .map((row) => {
      const obj: RawRow = {};
      headers.forEach((header, i) => {
        const cell = row[i];
        obj[header] = cell === undefined || cell === '' ? null : (cell as string | number);
      });
      return obj;
    });

  return {
    fileName: workbook.fileName,
    sheetName: sheet.name,
    headers,
    rows,
  };
}

function parseCsvText(fileName: string, text: string): ParsedWorkbook {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' });
  if (result.errors.length > 0 && (!result.data || result.data.length === 0)) {
    throw new FileParseError(`"${fileName}" okunamadı (CSV): ${result.errors[0].message}`);
  }
  const grid = (result.data as unknown[][]).map((row) => row.map((c) => normalizeCell(c)));
  if (grid.length === 0) throw new FileParseError(`"${fileName}" boş görünüyor.`);
  return { fileName, sheets: [makeSheet('Sheet 1', grid)] };
}

/**
 * Reads workbook bytes, whatever produced them.
 *
 * Kept separate from the browser's File API so the same parser can be driven
 * by a test fixture on disk — which is how this is checked against real
 * customer exports — and, later, by an ERP adapter that never touches a file
 * picker at all.
 */
export async function parseXlsxBuffer(
  fileName: string,
  buffer: ArrayBuffer,
): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  if (workbook.worksheets.length === 0) {
    throw new FileParseError(`"${fileName}" hiç sayfa içermiyor.`);
  }

  const sheets: ParsedSheet[] = [];
  for (const worksheet of workbook.worksheets) {
    const grid: Cell[][] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = row.values as unknown[];
      // ExcelJS row.values is 1-indexed with a leading empty slot; drop it.
      grid.push(values.slice(1).map((v) => normalizeCell(v)));
    });
    if (grid.length > 0) sheets.push(makeSheet(worksheet.name, grid));
  }

  if (sheets.length === 0) {
    throw new FileParseError(`"${fileName}" içindeki her sayfa boş.`);
  }
  return { fileName, sheets };
}

export async function parseWorkbook(file: File): Promise<ParsedWorkbook> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.txt') || name.endsWith('.tsv')) {
    return parseCsvText(file.name, await file.text());
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
    return parseXlsxBuffer(file.name, await file.arrayBuffer());
  }
  throw new FileParseError(
    `"${file.name}" desteklenmeyen bir dosya türü. .csv veya .xlsx yükleyin.`,
  );
}
