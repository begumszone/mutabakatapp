import { useMemo, useState } from 'react';
import type {
  ColumnMapping,
  Locale,
  PairReconciliation,
  ParsedFile,
  ParsedWorkbook,
  Party,
  Perspective,
  ReconciliationSettings,
  StatementEntry,
} from './types';
import { translate } from './lib/i18n';
import { sampleFiles } from './lib/sampleData';
import { FileParseError, parseWorkbook, sheetToParsedFile } from './adapters/parseFile';
import { suggestMapping, validateMapping } from './adapters/suggestMapping';
import { buildStatement, makeStatement, type BuildResult } from './adapters/buildStatement';
import { orientEntries } from './core/claim';
import { reconcilePair } from './core/reconcilePair';
import { todayIso } from './core/parseDate';
import { useTheme } from './hooks/useTheme';
import { FileDrop } from './components/FileDrop';
import { SideSetup, type SourceView } from './components/SideSetup';
import { ResultView } from './components/ResultView';

type Step = 'upload' | 'map' | 'result';

/**
 * One sheet contributing to a side's ledger.
 *
 * A side is a list of these rather than a single sheet, because real customer
 * cards arrive split — lira on one tab and euro on another, or one file per
 * date range. Each keeps its own mapping and orientation, since two tabs of
 * the same export genuinely can be shaped differently.
 */
interface Source {
  id: string;
  workbook: ParsedWorkbook | null;
  /** Set directly for the sample data, derived from the workbook otherwise. */
  directFile: ParsedFile | null;
  sheetIndex: number;
  headerRow: number;
  mapping: ColumnMapping;
  perspective: Perspective;
}

interface Side {
  partyName: string;
  sources: Source[];
}

const EMPTY_SIDE: Side = { partyName: '', sources: [] };

let nextSourceId = 0;

function fileOf(source: Source): ParsedFile | null {
  if (source.directFile) return source.directFile;
  if (!source.workbook) return null;
  try {
    return sheetToParsedFile(source.workbook, source.sheetIndex, source.headerRow);
  } catch {
    return null;
  }
}

/** Builds a source with its mapping and orientation guessed from the data. */
function makeSource(
  workbook: ParsedWorkbook | null,
  directFile: ParsedFile | null,
  sheetIndex: number,
  headerRow: number,
  perspective?: Perspective,
): Source | null {
  const base: Source = {
    id: `s${nextSourceId++}`,
    workbook,
    directFile,
    sheetIndex,
    headerRow,
    mapping: {
      date: null, dueDate: null, docNo: null, docNoAlt: null, docTypeColumn: null,
      description: null, amountLayout: 'debitCredit', debit: null, credit: null,
      amount: null, currency: null,
    },
    perspective: perspective ?? 'receivable',
  };
  const parsed = fileOf(base);
  if (!parsed) return null;
  const mapping = suggestMapping(parsed);
  const build = buildStatement(parsed, mapping);
  return { ...base, mapping, perspective: perspective ?? build.suggestedPerspective };
}

interface SideBuild {
  views: SourceView[];
  entries: StatementEntry[];
}

/**
 * Reads every source of one side into a single ledger.
 *
 * Entry ids are namespaced by source, so two sheets that both start at row 1
 * cannot collide — an id collision here would silently drop a line from the
 * balance or tie an action to the wrong row.
 */
function buildSide(side: Side): SideBuild {
  const views: SourceView[] = [];
  const entries: StatementEntry[] = [];

  for (const source of side.sources) {
    const parsed = fileOf(source);
    if (!parsed) continue;
    const build: BuildResult = buildStatement(parsed, source.mapping);
    views.push({
      id: source.id,
      workbook: source.workbook,
      parsed,
      sheetIndex: source.sheetIndex,
      headerRow: source.headerRow,
      mapping: source.mapping,
      perspective: source.perspective,
      build,
    });
    // Oriented here, so the merged ledger carries one direction even when two
    // sheets of the same side were written from opposite ones.
    for (const entry of orientEntries(build.entries, source.perspective)) {
      entries.push({ ...entry, id: `${source.id}:${entry.id}` });
    }
  }

  return { views, entries };
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

  const creditorBuild = useMemo(() => buildSide(creditorSide), [creditorSide]);
  const debtorBuild = useMemo(() => buildSide(debtorSide), [debtorSide]);

  const addFile = async (file: File, which: 'creditor' | 'debtor', replace: boolean) => {
    setError(null);
    try {
      const workbook = await parseWorkbook(file);
      const headerRow = workbook.sheets[0].suggestedHeaderRow;
      const source = makeSource(workbook, null, 0, headerRow);
      if (!source) throw new FileParseError(file.name);
      const setSide = which === 'creditor' ? setCreditorSide : setDebtorSide;
      setSide((side) => ({
        partyName: replace || !side.partyName ? file.name.replace(/\.[^.]+$/, '') : side.partyName,
        sources: replace ? [source] : [...side.sources, source],
      }));
    } catch (caught) {
      setError(caught instanceof FileParseError ? caught.message : String(caught));
    }
  };

  const loadSample = () => {
    const { creditor, debtor } = sampleFiles();
    const one = (parsed: ParsedFile, name: string, perspective: Perspective): Side => {
      const source = makeSource(null, parsed, 0, 0, perspective);
      return { partyName: name, sources: source ? [source] : [] };
    };
    setCreditorSide(one(creditor, 'ABC Limited', 'receivable'));
    setDebtorSide(one(debtor, 'Begüm Teknoloji', 'payable'));
    setSettings((current) => ({ ...current, asOfDate: '2026-06-30' }));
    setStep('map');
  };

  /** Applies a change to one source, re-guessing when the sheet moves under it. */
  const updateSource = (
    which: 'creditor' | 'debtor',
    sourceId: string,
    change: (source: Source) => Source,
  ) => {
    const setSide = which === 'creditor' ? setCreditorSide : setDebtorSide;
    setSide((side) => ({
      ...side,
      sources: side.sources.map((source) => (source.id === sourceId ? change(source) : source)),
    }));
  };

  /** A different sheet is a different table, so its mapping is guessed afresh. */
  const reguess = (source: Source, changes: Partial<Source>): Source => {
    const next = { ...source, ...changes };
    const parsed = fileOf(next);
    if (!parsed) return next;
    const mapping = suggestMapping(parsed);
    const build = buildStatement(parsed, mapping);
    return { ...next, mapping, perspective: build.suggestedPerspective };
  };

  const sideProps = (which: 'creditor' | 'debtor') => {
    const side = which === 'creditor' ? creditorSide : debtorSide;
    const setSide = which === 'creditor' ? setCreditorSide : setDebtorSide;
    const build = which === 'creditor' ? creditorBuild : debtorBuild;
    return {
      locale,
      title: t(`upload.${which}`),
      hint: t(`upload.${which}Hint`),
      partyName: side.partyName,
      onPartyName: (name: string) => setSide((s) => ({ ...s, partyName: name })),
      sources: build.views,
      totalEntries: build.entries.length,
      onSheetIndex: (id: string, index: number) =>
        updateSource(which, id, (source) =>
          reguess(source, {
            sheetIndex: index,
            headerRow: source.workbook?.sheets[index]?.suggestedHeaderRow ?? 0,
          }),
        ),
      onHeaderRow: (id: string, index: number) =>
        updateSource(which, id, (source) => reguess(source, { headerRow: index })),
      onMapping: (id: string, mapping: ColumnMapping) =>
        updateSource(which, id, (source) => ({ ...source, mapping })),
      onPerspective: (id: string, perspective: Perspective) =>
        updateSource(which, id, (source) => ({ ...source, perspective })),
      onRemoveSource: (id: string) =>
        setSide((s) => ({ ...s, sources: s.sources.filter((source) => source.id !== id) })),
      onAddSheet: (id: string, sheetIndex: number) =>
        setSide((s) => {
          const template = s.sources.find((source) => source.id === id);
          if (!template?.workbook) return s;
          const added = makeSource(
            template.workbook,
            null,
            sheetIndex,
            template.workbook.sheets[sheetIndex]?.suggestedHeaderRow ?? 0,
          );
          return added ? { ...s, sources: [...s.sources, added] } : s;
        }),
      onAddFile: (file: File) => void addFile(file, which, false),
    };
  };

  const hasBoth = creditorBuild.views.length > 0 && debtorBuild.views.length > 0;

  const mappingsUsable = (side: Side) =>
    side.sources.length > 0 &&
    side.sources.every((source) =>
      validateMapping(source.mapping).every((issue) => issue.severity !== 'error'),
    );

  const canRun = hasBoth && mappingsUsable(creditorSide) && mappingsUsable(debtorSide);

  const run = () => {
    if (!canRun) return;
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

    // Every source was oriented as it was read, so both merged ledgers are
    // already expressed as "the debtor owes the creditor". Applying a
    // perspective again here would undo that and double the reported gap.
    const label = (build: SideBuild): ParsedFile => ({
      fileName: build.views
        .map((view) => `${view.parsed.fileName} — ${view.parsed.sheetName}`)
        .join(' + '),
      sheetName: '',
      headers: [],
      rows: [],
    });

    const creditorStatement = makeStatement(
      'creditor',
      label(creditorBuild),
      creditorBuild.entries,
      creditor.id,
      debtor.id,
      'receivable',
    );
    const debtorStatement = makeStatement(
      'debtor',
      label(debtorBuild),
      debtorBuild.entries,
      debtor.id,
      creditor.id,
      'receivable',
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
              {(['creditor', 'debtor'] as const).map((which) => {
                const side = which === 'creditor' ? creditorSide : debtorSide;
                const setSide = which === 'creditor' ? setCreditorSide : setDebtorSide;
                const first = side.sources[0];
                const name = first
                  ? (first.workbook?.fileName ?? first.directFile?.fileName ?? null)
                  : null;
                return (
                  <section className="card" key={which}>
                    <div className="card-head">
                      <h2>{t(`upload.${which}`)}</h2>
                    </div>
                    <div className="card-body stack">
                      <p className="faint">{t(`upload.${which}Hint`)}</p>
                      <FileDrop
                        locale={locale}
                        fileName={name}
                        onFile={(file) => void addFile(file, which, true)}
                        onClear={() => setSide(EMPTY_SIDE)}
                      />
                    </div>
                  </section>
                );
              })}
            </div>

            <div className="row">
              <button
                className="primary"
                type="button"
                disabled={!hasBoth}
                onClick={() => setStep('map')}
              >
                {t('upload.continue')}
              </button>
              <button className="ghost" type="button" onClick={loadSample}>
                {t('upload.sample')}
              </button>
              {!hasBoth && <span className="faint">{t('upload.bothNeeded')}</span>}
            </div>
          </div>
        )}

        {step === 'map' && hasBoth && (
          <div className="stack">
            <div className="grid-2">
              <SideSetup {...sideProps('creditor')} />
              <SideSetup {...sideProps('debtor')} />
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
                      setSettings((s) => ({ ...s, allowDateAmountFallback: event.target.checked }))
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
