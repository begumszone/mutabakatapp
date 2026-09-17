# MutabakatAPP — working notes

Cari hesap mutabakatı: two firms upload their ledgers for the same
relationship, the app agrees the balance at a stated date and explains every
lira of whatever is left.

## Before saying anything is done

Unit tests passing is not "done". On 17.09 four commits of real work sat on a
feature branch while the deployment served `main`; the customer opened the
live site, saw the old app, and was told by us that it had changed. Nothing
about the source was wrong, so nothing in `npm test` could have caught it.

So, every time:

1. `npm test` and `npm run build` — necessary, not sufficient.
2. **Push to the branch the deployment actually serves**, and confirm it:
   `git ls-remote --heads origin` — the deployed branch must point at the new
   commit. Vercel serves `main`.
3. **Drive the built site**, not the source:
   ```
   npm run build
   npx vite preview --port 4199 &
   node e2e/smoke.mjs
   ```
   `e2e/smoke.mjs` uploads a real statement, answers the setup questions and
   asserts the figures two finance departments agreed by hand. It exits
   non-zero on any failure or any console error.
4. Only then report. If a check could not be run — the live host is
   unreachable from here, for one — say which check was skipped rather than
   implying the whole path was verified.

## What the numbers have to come out as

These are from real customer files and are the strongest check available. Do
not "fix" the engine until one of these is reproduced.

- **PAROS ↔ INGAGE at 30.06.2026** — PAROS 145.412,70, INGAGE 139.883,70,
  gap 5.529,00; and that gap is −99.522,00 carried in from the 31.12.2025
  opening plus 105.051,00 for a virman only PAROS booked.
- **AİR LIQUIDE ↔ AKVATEK at 31.08.2026** — the two ledgers differ by 0,01 on
  invoice AL42026000005577, which is the unexplained "−0,01" in the firms'
  own hand-made SONUÇ TABLOSU. Note AİR's export is a SAP open-item list: its
  rows total 30.467,42 while the balance both firms signed is 501.717,37,
  the sum of the rows SAP has not cleared.

## House rules this app is built on

- **Ask rather than guess where a wrong guess is invisible.** Which sheet,
  and which column is borç — both produce confident wrong answers, never
  errors. Nothing runs until they are answered.
- **A balance belongs to a date.** "Mutabakat tarihi" is the end of the
  comparison window, not a separate field; the result table names the date on
  every row it prints.
- **Show the arithmetic.** The gap between two balances is the opening
  difference plus the documents only one side booked plus the ones booked at
  two figures. Anything left over is printed as unexplained, never rounded.
- **Real customer files stay out of the repository.** `sample-data/*.xlsx` is
  ignored; tests that need them skip when they are absent.

## Layout

- `src/core/` — the engine: matching, period alignment, the balance bridge,
  the recommended actions. No React.
- `src/adapters/` — reading spreadsheets: header detection, column guessing,
  the fallback that reads unnamed columns from their data.
- `src/components/`, `src/App.tsx` — the three steps: upload, map, result.
- `e2e/smoke.mjs` — the check described above.
