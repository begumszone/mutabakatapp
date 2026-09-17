export type Cell = string | number | null;

/**
 * What `detectHeaderRowIndex` returns for a sheet that has no header row.
 *
 * Reading such a sheet must not consume its first line: every row is data.
 * Callers slice from `index + 1`, so -1 keeps the whole grid and the columns
 * fall back to generic names the user can label by hand.
 */
export const NO_HEADER_ROW = -1;

function isBlank(cell: Cell): boolean {
  return cell === null || cell === undefined || String(cell).trim() === '';
}

function filled(row: Cell[]): number {
  return row.filter((c) => !isBlank(c)).length;
}

/**
 * How many distinct values a row holds.
 *
 * A merged cell repeats its text across every column it spans, so a report
 * title stretched over the sheet arrives as one word twelve times. It is
 * wide and textual and sits above data — everything a header is scored for —
 * and on one real export it beat the actual header row and left the sheet
 * unreadable.
 */
function distinctCount(row: Cell[]): number {
  const seen = new Set<string>();
  for (const cell of row) {
    if (isBlank(cell)) continue;
    seen.add(String(cell).trim());
  }
  return seen.size;
}

/**
 * True when a cell reads as a calendar date.
 *
 * A header never holds one. Some ERP exports (SAP among them) ship the raw
 * table with no header row at all, and the scorer below would otherwise
 * crown the first transaction — turning an invoice number into a column
 * name and losing that line from the ledger entirely.
 */
function looksLikeDate(cell: Cell): boolean {
  if (cell === null || cell === undefined) return false;
  const text = String(cell).trim();
  if (text === '') return false;
  return (
    /^\d{4}-\d{2}-\d{2}/.test(text) ||
    /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(text)
  );
}

function numericCount(row: Cell[]): number {
  return row.filter((c) => typeof c === 'number' || (typeof c === 'string' && /^-?[\d.,\s]+$/.test(c.trim()) && /\d/.test(c))).length;
}

/**
 * Finds the row that is actually the column header.
 *
 * Real exports rarely start with the header: there is usually a report
 * title, a company name, a date range, and a blank row or two above it.
 * Taking row 0 blindly turns "ACME Ltd — 2026 Budget" into the column
 * names and every real column into data.
 *
 * The header is scored as the row that (a) has many non-blank cells,
 * (b) is mostly text rather than numbers, and (c) is followed by a row
 * that looks like data. Ties break toward the earliest row.
 */
export function detectHeaderRowIndex(grid: Cell[][]): number {
  const limit = Math.min(grid.length, 25); // headers never live 25 rows down
  let bestIndex = NO_HEADER_ROW;
  let bestScore = -Infinity;

  const widest = Math.max(1, ...grid.slice(0, limit).map(filled));

  for (let i = 0; i < limit; i++) {
    const row = grid[i];
    const cells = filled(row);
    if (cells < 2) continue; // a title row is typically one lonely cell

    const numbers = numericCount(row);
    const textCells = cells - numbers;
    const distinct = distinctCount(row);
    // Column names are all different from one another; a title is one value
    // repeated. Two distinct values across a wide row is a banner, not a
    // header.
    if (cells >= 3 && distinct <= Math.max(2, cells * 0.4)) continue;

    // Hard disqualifications. These are not "score a bit lower" signals:
    // a row holding a date, or made mostly of numbers, is a transaction.
    if (row.some(looksLikeDate)) continue;
    if (textCells < 2 || textCells / cells < 0.6) continue;

    const next = grid[i + 1];
    if (!next || filled(next) === 0) continue; // a header must be followed by data

    // A header is wide, textual, and sits above a row with real values.
    let score = 0;
    score += (cells / widest) * 3;
    score += (textCells / cells) * 3;
    score += numbers === 0 ? 1.5 : 0;
    score += filled(next) >= cells - 1 ? 1 : 0;
    score += numericCount(next) > 0 ? 1 : 0; // data rows usually carry numbers
    score -= i * 0.12; // prefer the earliest plausible row

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}
