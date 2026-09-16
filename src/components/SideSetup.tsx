import type {
  ColumnMapping,
  Locale,
  ParsedFile,
  ParsedWorkbook,
  Perspective,
} from '../types';
import { translate } from '../lib/i18n';
import { validateMapping } from '../adapters/suggestMapping';
import type { BuildResult } from '../adapters/buildStatement';

interface Props {
  locale: Locale;
  title: string;
  partyName: string;
  onPartyName: (name: string) => void;
  workbook: ParsedWorkbook | null;
  parsed: ParsedFile;
  sheetIndex: number;
  onSheetIndex: (index: number) => void;
  headerRow: number;
  onHeaderRow: (index: number) => void;
  mapping: ColumnMapping;
  onMapping: (mapping: ColumnMapping) => void;
  perspective: Perspective;
  onPerspective: (perspective: Perspective) => void;
  build: BuildResult;
}

const TEXT_FIELDS: (keyof ColumnMapping)[] = [
  'date',
  'dueDate',
  'docNo',
  'docNoAlt',
  'description',
  'currency',
];

/**
 * One side's setup: which sheet, where its headers are, which way round the
 * ledger is written, and what each column means.
 *
 * Everything the guesser decided is shown as an editable control rather than
 * applied silently, because a wrong guess here does not produce a small error
 * — it produces a confident, wrong reconciliation. The row counts underneath
 * are the quickest check that the right rows were read at all.
 */
export function SideSetup(props: Props) {
  const { locale, parsed, mapping, build } = props;
  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);

  const issues = validateMapping(mapping);
  const options = parsed.headers;

  const select = (field: keyof ColumnMapping, label: string) => (
    <label className="field" key={field}>
      {label}
      <select
        value={(mapping[field] as string | null) ?? ''}
        onChange={(event) =>
          props.onMapping({ ...mapping, [field]: event.target.value || null })
        }
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
    <section className="card">
      <div className="card-head">
        <h2>{props.title}</h2>
      </div>
      <div className="card-body stack">
        <label className="field">
          {t('upload.partyName')}
          <input
            type="text"
            value={props.partyName}
            onChange={(event) => props.onPartyName(event.target.value)}
          />
        </label>

        <div className="row">
          {props.workbook && props.workbook.sheets.length > 1 && (
            <label className="field">
              {t('mapping.sheet')}
              <select
                value={props.sheetIndex}
                onChange={(event) => props.onSheetIndex(Number(event.target.value))}
              >
                {props.workbook.sheets.map((sheet, index) => (
                  <option key={sheet.name} value={index}>
                    {sheet.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {props.workbook && (
            <label className="field">
              {t('mapping.headerRow')}
              <input
                type="number"
                min={1}
                max={Math.max(1, props.workbook.sheets[props.sheetIndex]?.grid.length ?? 1)}
                value={props.headerRow + 1}
                onChange={(event) => props.onHeaderRow(Math.max(0, Number(event.target.value) - 1))}
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
              aria-pressed={props.perspective === 'receivable'}
              onClick={() => props.onPerspective('receivable')}
            >
              {t('mapping.receivable')}
            </button>
            <button
              type="button"
              aria-pressed={props.perspective === 'payable'}
              onClick={() => props.onPerspective('payable')}
            >
              {t('mapping.payable')}
            </button>
          </div>
          <div className="faint">{t('mapping.perspectiveHint')}</div>
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <div className="small muted">{t('mapping.amountLayout')}</div>
          <div className="seg">
            <button
              type="button"
              aria-pressed={mapping.amountLayout === 'debitCredit'}
              onClick={() => props.onMapping({ ...mapping, amountLayout: 'debitCredit' })}
            >
              {t('mapping.debitCredit')}
            </button>
            <button
              type="button"
              aria-pressed={mapping.amountLayout === 'signed'}
              onClick={() => props.onMapping({ ...mapping, amountLayout: 'signed' })}
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
          <span>{t('mapping.rowsRead', { count: build.entries.length })}</span>
          {build.skippedNoDate > 0 && (
            <span>{t('mapping.skippedNoDate', { count: build.skippedNoDate })}</span>
          )}
          {build.skippedFooter > 0 && (
            <span>{t('mapping.skippedFooter', { count: build.skippedFooter })}</span>
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
    </section>
  );
}
