import type { ColumnMapping, Locale, ParsedFile, ParsedWorkbook, Perspective } from '../types';
import { translate } from '../lib/i18n';
import { validateMapping } from '../adapters/suggestMapping';
import type { BuildResult } from '../adapters/buildStatement';
import type { InferredColumns } from '../adapters/inferColumns';
import { FileDrop } from './FileDrop';

/** One sheet of one uploaded file, mapped into ledger lines. */
export interface SourceView {
  id: string;
  workbook: ParsedWorkbook | null;
  parsed: ParsedFile;
  sheetIndex: number;
  headerRow: number;
  mapping: ColumnMapping;
  perspective: Perspective;
  build: BuildResult;
  sheetConfirmed: boolean;
  columnHints: InferredColumns | null;
}

interface Props {
  locale: Locale;
  title: string;
  hint: string;
  partyName: string;
  onPartyName: (name: string) => void;
  sources: SourceView[];
  onSheetIndex: (sourceId: string, index: number) => void;
  onHeaderRow: (sourceId: string, index: number) => void;
  onMapping: (sourceId: string, mapping: ColumnMapping) => void;
  onPerspective: (sourceId: string, perspective: Perspective) => void;
  onRemoveSource: (sourceId: string) => void;
  onAddSheet: (sourceId: string, sheetIndex: number) => void;
  onAddFile: (file: File) => void;
  totalEntries: number;
}

const TEXT_FIELDS: (keyof ColumnMapping)[] = [
  'date',
  'dueDate',
  'docNo',
  'docNoAlt',
  'description',
  'currency',
  'clearingDoc',
];

function SourceCard({
  locale,
  source,
  removable,
  onSheetIndex,
  onHeaderRow,
  onMapping,
  onPerspective,
  onRemove,
}: {
  locale: Locale;
  source: SourceView;
  removable: boolean;
  onSheetIndex: (index: number) => void;
  onHeaderRow: (index: number) => void;
  onMapping: (mapping: ColumnMapping) => void;
  onPerspective: (perspective: Perspective) => void;
  onRemove: () => void;
}) {
  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const { mapping, build, parsed } = source;
  const issues = validateMapping(mapping);
  const options = parsed.headers;

  const select = (field: keyof ColumnMapping, label: string) => (
    <label className="field" key={field}>
      {label}
      <select
        value={(mapping[field] as string | null) ?? ''}
        onChange={(event) => onMapping({ ...mapping, [field]: event.target.value || null })}
      >
        <option value="">{t('mapping.none')}</option>
        {options.map((header) => (
          <option key={header} value={header}>
            {header}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="source">
      <div className="source-head">
        <span className="source-title">{parsed.sheetName}</span>
        <span className="faint">{parsed.fileName}</span>
        <span className="spacer" />
        <span className="faint small">{t('mapping.rowsRead', { count: build.entries.length })}</span>
        {removable && (
          <button className="ghost small" type="button" onClick={onRemove} title={t('mapping.removeSource')}>
            ✕
          </button>
        )}
      </div>

      <div className="source-body stack">
        {source.workbook && source.workbook.sheets.length > 1 && !source.sheetConfirmed && (
          <div className="notice ask-block">
            <div className="ask">
              {t('mapping.whichSheet', { count: source.workbook.sheets.length })}
            </div>
            <p className="small" style={{ margin: '4px 0 8px' }}>{t('mapping.whichSheetHint')}</p>
            <div className="sheet-choices">
              {source.workbook.sheets.map((sheet, index) => (
                <button
                  key={sheet.name}
                  type="button"
                  className="sheet-choice"
                  onClick={() => onSheetIndex(index)}
                >
                  <strong>{sheet.name}</strong>
                  <span className="faint small">
                    {t('mapping.sheetRows', { count: sheet.grid.length })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {source.columnHints && source.columnHints.ambiguousMoneyColumns.length > 0 && (
          <div className="notice error ask-block">
            <div className="ask">{t('mapping.whichMoney')}</div>
            <p className="small" style={{ margin: '4px 0 0' }}>
              {t('mapping.whichMoneyHint', {
                columns: source.columnHints.ambiguousMoneyColumns.join(', '),
              })}
            </p>
            {source.columnHints.balanceColumns.length > 0 && (
              <p className="small" style={{ margin: '6px 0 0' }}>
                {t('mapping.balanceColumns', {
                  columns: source.columnHints.balanceColumns.join(', '),
                })}
              </p>
            )}
          </div>
        )}

        <div className="row">
          {source.workbook && source.workbook.sheets.length > 1 && (
            <label className="field">
              {t('mapping.sheet')}
              <select
                value={source.sheetIndex}
                onChange={(event) => onSheetIndex(Number(event.target.value))}
              >
                {source.workbook.sheets.map((sheet, index) => (
                  <option key={sheet.name} value={index}>
                    {sheet.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {source.workbook && (
            <label className="field">
              {t('mapping.headerRow')}
              <input
                type="number"
                min={1}
                max={Math.max(1, source.workbook.sheets[source.sheetIndex]?.grid.length ?? 1)}
                value={source.headerRow + 1}
                onChange={(event) => onHeaderRow(Math.max(0, Number(event.target.value) - 1))}
                style={{ width: 90 }}
              />
            </label>
          )}
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <div className="small muted">{t('mapping.perspective')}</div>
          <div className="seg">
            <button
              type="button"
              aria-pressed={source.perspective === 'receivable'}
              onClick={() => onPerspective('receivable')}
            >
              {t('mapping.receivable')}
            </button>
            <button
              type="button"
              aria-pressed={source.perspective === 'payable'}
              onClick={() => onPerspective('payable')}
            >
              {t('mapping.payable')}
            </button>
          </div>
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <div className="small muted">{t('mapping.amountLayout')}</div>
          <div className="seg">
            <button
              type="button"
              aria-pressed={mapping.amountLayout === 'debitCredit'}
              onClick={() => onMapping({ ...mapping, amountLayout: 'debitCredit' })}
            >
              {t('mapping.debitCredit')}
            </button>
            <button
              type="button"
              aria-pressed={mapping.amountLayout === 'signed'}
              onClick={() => onMapping({ ...mapping, amountLayout: 'signed' })}
            >
              {t('mapping.signed')}
            </button>
          </div>
        </div>

        <div className="grid-2" style={{ gap: 12 }}>
          {TEXT_FIELDS.map((field) => select(field, t(`mapping.field.${field}`)))}
          {mapping.amountLayout === 'debitCredit'
            ? [
                select('debit', t('mapping.field.debit')),
                select('credit', t('mapping.field.credit')),
              ]
            : select('amount', t('mapping.field.amount'))}
        </div>

        <div className="row small muted" style={{ gap: 14 }}>
          {build.skippedNoDate > 0 && (
            <span>{t('mapping.skippedNoDate', { count: build.skippedNoDate })}</span>
          )}
          {build.skippedFooter > 0 && (
            <span>{t('mapping.skippedFooter', { count: build.skippedFooter })}</span>
          )}
          {build.zeroAmount > 0 && (
            <span className={build.zeroAmount > build.entries.length / 2 ? 'neg' : undefined}>
              {t('mapping.zeroAmount', { count: build.zeroAmount })}
            </span>
          )}
        </div>

        {issues.map((issue) => (
          <div
            key={issue.messageKey}
            className={issue.severity === 'error' ? 'notice error' : 'notice'}
          >
            {t(issue.messageKey, issue.messageVars)}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * One side's setup — its name, and every sheet that makes up its ledger.
 *
 * A side is rarely one sheet. The same customer card routinely arrives split
 * by currency, with the lira movements on one tab and the euro ones on
 * another, or split across two exported files for two date ranges. Treating a
 * side as a list of sources rather than a single sheet is what lets those
 * reconcile at all: leave the euro tab out and its invoices come back as
 * "missing records" that are not missing, just on the other tab.
 *
 * Each source carries its own mapping and its own orientation, because the
 * two tabs of one export genuinely can differ — one may use a signed column
 * and the other a borç/alacak pair. Everything the guesser decided is shown
 * as an editable control rather than applied silently: a wrong guess here
 * does not produce a small error, it produces a confident wrong result.
 */
export function SideSetup(props: Props) {
  const { locale, sources } = props;
  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);

  const first = sources[0];
  const unusedSheets =
    first?.workbook?.sheets
      .map((sheet, index) => ({ sheet, index }))
      .filter(({ index }) => !sources.some((s) => s.workbook === first.workbook && s.sheetIndex === index)) ?? [];

  return (
    <section className="card">
      <div className="card-head">
        <h2>{props.title}</h2>
        <span className="spacer" />
        <span className="faint small">{t('mapping.rowsRead', { count: props.totalEntries })}</span>
      </div>
      <div className="card-body stack">
        <p className="faint">{props.hint}</p>

        <label className="field">
          {t('upload.partyName')}
          <input
            type="text"
            value={props.partyName}
            onChange={(event) => props.onPartyName(event.target.value)}
          />
        </label>

        {sources.map((source) => (
          <SourceCard
            key={source.id}
            locale={locale}
            source={source}
            removable={sources.length > 1}
            onSheetIndex={(index) => props.onSheetIndex(source.id, index)}
            onHeaderRow={(index) => props.onHeaderRow(source.id, index)}
            onMapping={(mapping) => props.onMapping(source.id, mapping)}
            onPerspective={(perspective) => props.onPerspective(source.id, perspective)}
            onRemove={() => props.onRemoveSource(source.id)}
          />
        ))}

        {unusedSheets.length > 0 && (
          <div className="row small">
            <span className="muted">{t('mapping.addSheet')}</span>
            {unusedSheets.map(({ sheet, index }) => (
              <button
                key={sheet.name}
                className="small"
                type="button"
                onClick={() => props.onAddSheet(first.id, index)}
              >
                + {sheet.name}
              </button>
            ))}
          </div>
        )}

        <div className="stack" style={{ gap: 6 }}>
          <span className="small muted">{t('mapping.addFile')}</span>
          <FileDrop locale={locale} fileName={null} onFile={props.onAddFile} onClear={() => {}} />
        </div>
      </div>
    </section>
  );
}
