import { round2 } from './parseNumber';

const ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})/;
const YEAR_FIRST = /^(\d{4})[./](\d{1,2})[./](\d{1,2})/;
const THREE_PARTS = /^(\d{1,2})([./-])(\d{1,2})\2(\d{2,4})/;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function build(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const full = year < 100 ? (year > 70 ? 1900 + year : 2000 + year) : year;
  if (full < 1900 || full > 2200) return null;
  return `${full}-${pad(month)}-${pad(day)}`;
}

/**
 * Reads a date out of a cari ekstre cell and returns it as ISO YYYY-MM-DD.
 *
 * The separator is what settles the ambiguous cases, because the two systems
 * these files come from write dates differently and both appear in one
 * reconciliation. A Turkish ERP export writes `31.12.2025` with dots, day
 * first. A SAP export writes `1/5/2026` with slashes, month first — the same
 * sheet carries `8/31/2026`, which could not be a day-first date at all. So
 * dots are read day first, slashes month first, and either way a first part
 * above 12 falls back to the only reading that can be a real date.
 *
 * Also handles ISO text, real Date objects from xlsx, and Excel serials.
 */
export function parseDate(value: string | number | Date | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }

  if (typeof value === 'number') {
    // Excel serial date: days since 1899-12-30, the leap-year bug included.
    if (!Number.isFinite(value) || value < 1 || value > 100000) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }

  const text = String(value).trim();
  if (text === '') return null;

  let m = ISO.exec(text);
  if (m) return build(Number(m[1]), Number(m[2]), Number(m[3]));

  m = YEAR_FIRST.exec(text);
  if (m) return build(Number(m[1]), Number(m[2]), Number(m[3]));

  m = THREE_PARTS.exec(text);
  if (m) {
    const first = Number(m[1]);
    const separator = m[2];
    const second = Number(m[3]);
    const year = Number(m[4]);
    const monthFirst = separator === '/';
    if (monthFirst && first <= 12) return build(year, first, second);
    if (monthFirst && second <= 12) return build(year, second, first);
    if (first <= 31 && second <= 12) return build(year, second, first);
    if (second <= 31 && first <= 12) return build(year, first, second);
    return null;
  }
  return null;
}

/** Whole calendar days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

/** ISO date `days` after `date`. Used to derive a vade from payment terms. */
export function addDays(date: string, days: number): string {
  const base = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(base)) return date;
  const d = new Date(base + round2(days) * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Today as ISO, in the browser's local calendar. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
