import { useMemo, useState } from 'react';
import type {
  ColumnMapping,
  Locale,
  ParsedFile,
  ParsedWorkbook,
  PairReconciliation,
  Party,
  Perspective,
  ReconciliationSettings,
} from './types';
import { translate } from './lib/i18n';
import { sampleFiles } from './lib/sampleData';
import { FileParseError, parseWorkbook, sheetToParsedFile } from './adapters/parseFile';
import { suggestMapping, validateMapping } from './adapters/suggestMapping';
import { buildStatement, makeStatement, type BuildResult } from './adapters/buildStatement';
import { reconcilePair } from './core/reconcilePair';
import { todayIso } from './core/parseDate';
import { useTheme } from './hooks/useTheme';
import { FileDrop } from './components/FileDrop';
import { SideSetup } from './components/SideSetup';
import { ResultView } from './components/ResultView';

type Step = 'upload' | 'map' | 'result';

/** Everything the app knows about one of the two sides. */
interface Side {
  workbook: ParsedWorkbook | null;
  /** Set directly for sample data, derived from the workbook otherwise. */
  directFile: ParsedFile | null;
  sheetIndex: number;
  headerRow: number;
  mapping: ColumnMapping | null;
  perspective: Perspective | null;
  partyName: string;
}

const EMPTY_SIDE: Side = {
  workbook: null,
  directFile: null,
  sheetIndex: 0,
  headerRow: 0,
  mapping: null,
  perspective: null,
  partyName: '',
};

function fileOf(side: Side): ParsedFile | null {
  if (side.directFile) return side.directFile;
  if (!side.workbook) return null;
  try {
    return sheetToParsedFile(side.workbook, side.sheetIndex, side.headerRow);
  } catch {
    return null;
  }
}

export function App() {
  const [locale, setLocale] = useState<Locale>('tr');
  const [theme, setTheme] = useTheme();
  const [step, setStep] = useState<Step>('upload');
  const [error, setError] = useState<string | null>(null);

  const [creditorSide, setCreditorSide] = useState<Side>(EMPTY_SIDE);
  const [debtorSide, setDebtorSide] = useState<Side>(EMPTY_SIDE);

  const [settings, setSettings] = useState<ReconciliationSettings>({
    amountTolerance: 0.01,
    dayTolerance: 7,
    allowDateAmountFallback: true,
    termDays: 30,
    asOfDate: todayIso(),
  });

  const [result, setResult] = useState<PairReconciliation | null>(null);

  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);

  const creditorFile = fileOf(creditorSide);
  const debtorFile = fileOf(debtorSide);

  // Mapping and orientation are recomputed whenever the sheet underneath them
  // changes, but only where the user has not already overridden them.
  const creditorBuild: BuildResult | null = useMemo(
    () =>
      creditorFile && creditorSide.mapping
        ? buildStatement(creditorFile, creditorSide.mapping)
        : null,
    [creditorFile, creditorSide.mapping],
  );
  const debtorBuild: BuildResult | null = useMemo(
    () => (debtorFile && debtorSide.mapping ? buildStatement(debtorFile, debtorSide.mapping) : null),
    [debtorFile, debtorSide.mapping],
  );

  const loadFile = async (file: File, which: 'creditor' | 'debtor') => {
    setError(null);
    try {
      const workbook = await parseWorkbook(file);
      const sheetIndex = 0;
      const headerRow = workbook.sheets[0].suggestedHeaderRow;
      const parsed = sheetToParsedFile(workbook, sheetIndex, headerRow);
      const mapping = suggestMapping(parsed);
      const build = buildStatement(parsed, mapping);
      const next: Side = {
        workbook,
        directFile: null,
        sheetIndex,
        headerRow,
        mapping,
        perspective: build.suggestedPerspective,
        partyName: file.name.replace(/\.[^.]+$/, ''),
      };
      if (which === 'creditor') setCreditorSide(next);
      else setDebtorSide(next);
    } catch (caught) {
      setError(caught instanceof FileParseError ? caught.message : String(caught));
    }
  };

  const loadSample = () => {
    const { creditor, debtor } = sampleFiles();
    const make = (parsed: ParsedFile, name: string, perspective: Perspective): Side => {
      const mapping = suggestMapping(parsed);
      return {
        workbook: null,
        directFile: parsed,
        sheetIndex: 0,
        headerRow: 0,
        mapping,
        perspective,
        partyName: name,
      };
    };
    setCreditorSide(make(creditor, 'ABC Limited', 'receivable'));
    setDebtorSide(make(debtor, 'Begüm Teknoloji', 'payable'));
    setSettings((current) => ({ ...current, asOfDate: '2026-06-30' }));
    setStep('map');
  };

  /** Re-reads a side after the user changes its sheet or header row. */
  const reread = (side: Side, changes: Partial<Side>): Side => {
    const next = { ...side, ...changes };
    if (!next.workbook) return next;
    try {
      const parsed = sheetToParsedFile(next.workbook, next.sheetIndex, next.headerRow);
      const mapping = suggestMapping(parsed);
      const build = buildStatement(parsed, mapping);
      return { ...next, mapping, perspective: build.suggestedPerspective };
    } catch {
      return next;
    }
  };

  const canRun =
    creditorFile !== null &&
    debtorFile !== null &&
    creditorSide.mapping !== null &&
    debtorSide.mapping !== null &&
    validateMapping(creditorSide.mapping).every((issue) => issue.severity !== 'error') &&
    validateMapping(debtorSide.mapping).every((issue) => issue.severity !== 'error');

  const run = () => {
    if (!creditorFile || !debtorFile || !creditorBuild || !debtorBuild) return;
    const creditor: Party = {
      id: 'creditor',
      name: creditorSide.partyName || t('common.creditor'),
      taxId: null,
    };
    const debtor: Party = {
      id: 'debtor',
      name: debtorSide.partyName || t('common.debtor'),
      taxId: null,
    };
    const creditorStatement = makeStatement(
      'creditor',
      creditorFile,
      creditorBuild.entries,
      creditor.id,
      debtor.id,
      creditorSide.perspective ?? creditorBuild.suggestedPerspective,
    );
    const debtorStatement = makeStatement(
      'debtor',
      debtorFile,
      debtorBuild.entries,
      debtor.id,
      creditor.id,
      debtorSide.perspective ?? debtorBuild.suggestedPerspective,
    );
    setResult(reconcilePair(creditor, debtor, creditorStatement, debtorStatement, settings));
    setStep('result');
  };

  const restart = () => {
    setCreditorSide(EMPTY_SIDE);
    setDebtorSide(EMPTY_SIDE);
    setResult(null);
    setStep('upload');
  };

  const stepIndex = step === 'upload' ? 0 : step === 'map' ? 1 : 2;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="mark">{t('app.title')}</span>
          <span className="tag">cari hesap</span>
        </div>
        <nav className="steps" aria-label={t('app.title')}>
          {[t('step.upload'), t('step.map'), t('step.result')].map((label, index) => (
            <span key={label} className="row" style={{ gap: 8 }}>
              {index > 0 && <span className="sep">›</span>}
              <span
                className={
                  index === stepIndex ? 'step active' : index < stepIndex ? 'step done' : 'step'
                }
              >
                <span className="dot">{index < stepIndex ? '✓' : index + 1}</span>
                {label}
              </span>
            </span>
          ))}
        </nav>
        <span className="spacer" />
        <div className="seg">
          <button type="button" aria-pressed={locale === 'tr'} onClick={() => setLocale('tr')}>
            TR
          </button>
          <button type="button" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>
            EN
          </button>
        </div>
        <button
          className="ghost"
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="tema"
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </header>

      <main className={step === 'result' ? 'main wide' : 'main'}>
        {error && <div className="notice error" style={{ marginBottom: 16 }}>{error}</div>}

        {step === 'upload' && (
          <div className="stack">
            <div className="stack" style={{ gap: 6 }}>
              <h1>{t('app.subtitle')}</h1>
              <p className="faint">{t('app.privacy')}</p>
            </div>

            <div className="grid-2">
              {(
                [
                  ['creditor', creditorSide, setCreditorSide],
                  ['debtor', debtorSide, setDebtorSide],
                ] as const
              ).map(([which, side, setSide]) => (
                <section className="card" key={which}>
                  <div className="card-head">
                    <h2>{t(`upload.${which}`)}</h2>
                  </div>
                  <div className="card-body stack">
                    <p className="faint">{t(`upload.${which}Hint`)}</p>
                    <FileDrop
                      locale={locale}
                      fileName={side.workbook?.fileName ?? side.directFile?.fileName ?? null}
                      onFile={(file) => void loadFile(file, which)}
                      onClear={() => setSide(EMPTY_SIDE)}
                    />
                  </div>
                </section>
              ))}
            </div>

            <div className="row">
              <button
                className="primary"
                type="button"
                disabled={!creditorFile || !debtorFile}
                onClick={() => setStep('map')}
              >
                {t('upload.continue')}
              </button>
              <button className="ghost" type="button" onClick={loadSample}>
                {t('upload.sample')}
              </button>
              {(!creditorFile || !debtorFile) && (
                <span className="faint">{t('upload.bothNeeded')}</span>
              )}
            </div>
          </div>
        )}

        {step === 'map' && creditorFile && debtorFile && creditorSide.mapping && debtorSide.mapping && creditorBuild && debtorBuild && (
          <div className="stack">
            <div className="grid-2">
              <SideSetup
                locale={locale}
                title={t('upload.creditor')}
                partyName={creditorSide.partyName}
                onPartyName={(name) => setCreditorSide((s) => ({ ...s, partyName: name }))}
                workbook={creditorSide.workbook}
                parsed={creditorFile}
                sheetIndex={creditorSide.sheetIndex}
                onSheetIndex={(index) =>
                  setCreditorSide((s) => reread(s, { sheetIndex: index, headerRow: s.workbook?.sheets[index]?.suggestedHeaderRow ?? 0 }))
                }
                headerRow={creditorSide.headerRow}
                onHeaderRow={(index) => setCreditorSide((s) => reread(s, { headerRow: index }))}
                mapping={creditorSide.mapping}
                onMapping={(mapping) => setCreditorSide((s) => ({ ...s, mapping }))}
                perspective={creditorSide.perspective ?? creditorBuild.suggestedPerspective}
                onPerspective={(perspective) => setCreditorSide((s) => ({ ...s, perspective }))}
                build={creditorBuild}
              />
              <SideSetup
                locale={locale}
                title={t('upload.debtor')}
                partyName={debtorSide.partyName}
                onPartyName={(name) => setDebtorSide((s) => ({ ...s, partyName: name }))}
                workbook={debtorSide.workbook}
                parsed={debtorFile}
                sheetIndex={debtorSide.sheetIndex}
                onSheetIndex={(index) =>
                  setDebtorSide((s) => reread(s, { sheetIndex: index, headerRow: s.workbook?.sheets[index]?.suggestedHeaderRow ?? 0 }))
                }
                headerRow={debtorSide.headerRow}
                onHeaderRow={(index) => setDebtorSide((s) => reread(s, { headerRow: index }))}
                mapping={debtorSide.mapping}
                onMapping={(mapping) => setDebtorSide((s) => ({ ...s, mapping }))}
                perspective={debtorSide.perspective ?? debtorBuild.suggestedPerspective}
                onPerspective={(perspective) => setDebtorSide((s) => ({ ...s, perspective }))}
                build={debtorBuild}
              />
            </div>

            <section className="card">
              <div className="card-head">
                <h2>{t('settings.title')}</h2>
              </div>
              <div className="card-body row" style={{ gap: 18, alignItems: 'flex-end' }}>
                <label className="field">
                  {t('settings.asOf')}
                  <input
                    type="date"
                    value={settings.asOfDate}
                    onChange={(event) =>
                      setSettings((s) => ({ ...s, asOfDate: event.target.value }))
                    }
                  />
                </label>
                <label className="field">
                  {t('settings.termDays')}
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={settings.termDays}
                    style={{ width: 90 }}
                    onChange={(event) =>
                      setSettings((s) => ({ ...s, termDays: Number(event.target.value) }))
                    }
                  />
                </label>
                <label className="field">
                  {t('settings.amountTolerance')}
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={settings.amountTolerance}
                    style={{ width: 100 }}
                    onChange={(event) =>
                      setSettings((s) => ({ ...s, amountTolerance: Number(event.target.value) }))
                    }
                  />
                </label>
                <label className="field">
                  {t('settings.dayTolerance')}
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={settings.dayTolerance}
                    style={{ width: 90 }}
                    onChange={(event) =>
                      setSettings((s) => ({ ...s, dayTolerance: Number(event.target.value) }))
                    }
                  />
                </label>
                <label className="row small" style={{ gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={settings.allowDateAmountFallback}
                    onChange={(event) =>
                      setSettings((s) => ({
                        ...s,
                        allowDateAmountFallback: event.target.checked,
                      }))
                    }
                  />
                  {t('settings.fallback')}
                </label>
              </div>
            </section>

            <div className="row">
              <button className="primary" type="button" disabled={!canRun} onClick={run}>
                {t('mapping.run')}
              </button>
              <button className="ghost" type="button" onClick={() => setStep('upload')}>
                {t('mapping.back')}
              </button>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <ResultView locale={locale} result={result} onRestart={restart} />
        )}
      </main>
    </div>
  );
}
