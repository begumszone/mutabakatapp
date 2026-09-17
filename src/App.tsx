import { useMemo, useState } from 'react';
import type {
  ColumnMapping,
  Locale,
  Period,
  PairReconciliation,
  ParsedFile,
  ParsedWorkbook,
  Party,
  Perspective,
  ReconciliationSettings,
  StatementEntry,
} from './types';
import { translate } from './lib/i18n';
import { formatDate } from './lib/formatters';
import { sampleFiles, samplePeriodMismatch } from './lib/sampleData';
import { FileParseError, parseWorkbook, sheetToParsedFile } from './adapters/parseFile';
import { suggestMapping, validateMapping } from './adapters/suggestMapping';
import { inferColumns, looksHeaderless, type InferredColumns } from './adapters/inferColumns';
import { buildStatement, makeStatement, type BuildResult } from './adapters/buildStatement';
import { EMPTY_PREAMBLE, readPreamble, type Preamble } from './adapters/readPreamble';
import { orientEntries } from './core/claim';
import { reconcilePair } from './core/reconcilePair';
import { todayIso } from './core/parseDate';
import { useTheme } from './hooks/useTheme';
import { FileDrop } from './components/FileDrop';
import { buildSampleWorkbook, sampleWorkbookName, type SampleSide } from './lib/sampleWorkbook';
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
  /** What the sheet said about itself above its column headers. */
  preamble: Preamble;
  /**
   * Whether a person has said which sheet of this workbook to use.
   *
   * A workbook with one sheet answers the question by existing. With several,
   * picking the first one silently is how a reconciliation ends up run
   * against a working tab or last year's data without anybody noticing, so
   * nothing runs until somebody chooses.
   */
  sheetConfirmed: boolean;
  /** What reading an unnamed sheet could not settle, when it could not. */
  columnHints: InferredColumns | null;
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
  sheetConfirmed?: boolean,
): Source | null {
  const base: Source = {
    id: `s${nextSourceId++}`,
    workbook,
    directFile,
    sheetIndex,
    headerRow,
    mapping: {
      date: null, docNo: null, docNoAlt: null, docTypeColumn: null,
      description: null, amountLayout: 'debitCredit', debit: null, credit: null,
      amount: null, currency: null, clearingDoc: null,
    },
    perspective: perspective ?? 'receivable',
    preamble: EMPTY_PREAMBLE,
    sheetConfirmed: false,
    columnHints: null,
  };
  const parsed = fileOf(base);
  if (!parsed) return null;
  const mapping = suggestMapping(parsed);
  const build = buildStatement(parsed, mapping);
  const grid = workbook?.sheets[sheetIndex]?.grid;
  const preamble = grid ? readPreamble(grid, headerRow) : EMPTY_PREAMBLE;
  return {
    ...base,
    mapping,
    preamble,
    perspective: perspective ?? build.suggestedPerspective,
    sheetConfirmed: sheetConfirmed ?? (workbook?.sheets.length ?? 1) <= 1,
    columnHints: looksHeaderless(parsed) ? inferColumns(parsed) : null,
  };
}

interface SideBuild {
  views: SourceView[];
  entries: StatementEntry[];
}

/**
 * The best name available for one side of the relationship.
 *
 * A firm's own ekstre names it at the top; the *other* firm's ekstre names it
 * again, as the counterparty whose card is being kept. Either is better than
 * the file name, which on these exports reads "AİR LIQUIDE-AKVATEK SU AŞ
 * FARK TABLOSU" and would go straight onto the result table as a company.
 */
function suggestPartyName(own: Side, other: Side): string | null {
  for (const source of own.sources) {
    if (source.preamble.ownerName) return source.preamble.ownerName;
  }
  for (const source of other.sources) {
    if (source.preamble.counterpartyName) return source.preamble.counterpartyName;
  }
  return null;
}

/**
 * A firm's tax number as recorded by the *other* side.
 *
 * Each ekstre carries the tax number of the counterparty whose card it keeps,
 * not its own — so the figure that identifies this firm is printed on the
 * other firm's statement.
 */
function firstTaxId(other: Side): string | null {
  for (const source of other.sources) {
    if (source.preamble.counterpartyTaxId) return source.preamble.counterpartyTaxId;
  }
  return null;
}

/** The period a side's sheets state, when any of them state one. */
function statedPeriodOf(side: Side): Period | null {
  for (const source of side.sources) {
    const { periodStart, periodEnd } = source.preamble;
    if (periodStart && periodEnd) return { start: periodStart, end: periodEnd };
  }
  return null;
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
      sheetConfirmed: source.sheetConfirmed,
      columnHints: source.columnHints,
    });
    // Oriented here, so the merged ledger carries one direction even when two
    // sheets of the same side were written from opposite ones.
    for (const entry of orientEntries(build.entries, source.perspective)) {
      entries.push({ ...entry, id: `${source.id}:${entry.id}` });
    }
  }

  return { views, entries };
}

/**
 * The windows people actually ask for.
 *
 * Cari hesap mutabakatı is normally run from the start of the year; the other
 * common ask is two or three years at once, when nobody has reconciled for a
 * while and the devir itself is in doubt.
 */
const PERIOD_PRESETS = [
  { key: 'ytd', years: 1 },
  { key: 'twoYears', years: 2 },
  { key: 'threeYears', years: 3 },
] as const;

type PresetKey = (typeof PERIOD_PRESETS)[number]['key'] | 'custom';

/**
 * Where the window starts, counting back from the mutabakat tarihi.
 *
 * Cari hesap mutabakatı is normally run from the start of the year the
 * balance date falls in. The multi-year options exist because when nobody has
 * reconciled for a while the devir itself is in doubt, and the only way to
 * settle it is to go back far enough to see it formed.
 *
 * There is deliberately no "last year" button. Every window ends at the
 * mutabakat tarihi, so "last year" could only mean "from the start of last
 * year" — which is what "son 2 yıl" already says. Two buttons that set the
 * same date are a bug the reader has to discover.
 */
function presetRange(key: PresetKey, asOf: string): { start: string; end: string } | null {
  const year = Number(asOf.slice(0, 4));
  switch (key) {
    case 'ytd':
      return { start: `${year}-01-01`, end: asOf };
    case 'twoYears':
      return { start: `${year - 1}-01-01`, end: asOf };
    case 'threeYears':
      return { start: `${year - 2}-01-01`, end: asOf };
    default:
      return null;
  }
}

/** The day a devir is struck: the one before the window opens. */
function dayBefore(iso: string): string {
  if (!iso) return '';
  const day = new Date(`${iso}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

/** The earlier of two ISO dates; a blank one is not a boundary at all. */
function minDate(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

const SETUP_TABS = ['sides', 'period'] as const;
type SetupTab = (typeof SETUP_TABS)[number];

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
    requestedPeriod: null,
    asOfDate: todayIso(),
  });

  const [period, setPeriodState] = useState<{ start: string; end: string }>(
    () => presetRange('ytd', todayIso()) ?? { start: '', end: todayIso() },
  );
  const [activePreset, setActivePreset] = useState<PresetKey>('ytd');

  /** Typing a date by hand means the reader has left the presets behind. */
  const setPeriod = (which: 'start' | 'end', value: string) => {
    setActivePreset('custom');
    setPeriodState((current) => ({ ...current, [which]: value }));
  };

  /**
   * The mutabakat tarihi is the end of the window, not a separate date.
   *
   * "30.06.2026 mutabakatı" means the movements up to and including that day.
   * Letting the two drift apart produced a table headed 30.06.2026 whose
   * balances included July.
   */
  const setAsOf = (value: string) => {
    setSettings((s) => ({ ...s, asOfDate: value }));
    setPeriodState((current) => ({ ...current, end: value }));
    setActivePreset('custom');
  };

  const applyPreset = (key: PresetKey) => {
    const range = presetRange(key, settings.asOfDate || todayIso());
    if (!range) return;
    setActivePreset(key);
    setPeriodState(range);
  };

  const [setupTab, setSetupTab] = useState<SetupTab>('sides');

  const [result, setResult] = useState<PairReconciliation | null>(null);
  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);

  const creditorBuild = useMemo(() => buildSide(creditorSide), [creditorSide]);
  const debtorBuild = useMemo(() => buildSide(debtorSide), [debtorSide]);

  // What the files say the two firms are called, unless the user has said
  // otherwise. Typed names always win: the reader can see both.
  const creditorName =
    creditorSide.partyName || suggestPartyName(creditorSide, debtorSide) || t('common.creditor');
  const debtorName =
    debtorSide.partyName || suggestPartyName(debtorSide, creditorSide) || t('common.debtor');


  const addFile = async (file: File, which: 'creditor' | 'debtor', replace: boolean) => {
    setError(null);
    try {
      const workbook = await parseWorkbook(file);
      const headerRow = workbook.sheets[0].suggestedHeaderRow;
      const source = makeSource(workbook, null, 0, headerRow);
      if (!source) throw new FileParseError(file.name);
      const setSide = which === 'creditor' ? setCreditorSide : setDebtorSide;
      setSide((side) => ({
        // The file name is the last resort. When one workbook holds both
        // sides — which is how every fark tablosu is built — naming both
        // parties after the file leaves a result table with the same name in
        // both columns, and nobody can tell which figure is whose.
        partyName:
          replace || !side.partyName
            ? file.name.replace(/\.[^.]+$/, '')
            : side.partyName,
        sources: replace ? [source] : [...side.sources, source],
      }));
    } catch (caught) {
      setError(caught instanceof FileParseError ? caught.message : String(caught));
    }
  };

  const loadSample = (which: 'matched' | 'periodMismatch') => {
    const one = (parsed: ParsedFile, name: string, perspective: Perspective): Side => {
      const source = makeSource(null, parsed, 0, 0, perspective, true);
      return { partyName: name, sources: source ? [source] : [] };
    };
    if (which === 'periodMismatch') {
      const { creditor, debtor } = samplePeriodMismatch();
      setCreditorSide(one(creditor, 'Koru Sigorta', 'receivable'));
      setDebtorSide(one(debtor, 'ABC Limited', 'payable'));
    } else {
      const { creditor, debtor } = sampleFiles();
      setCreditorSide(one(creditor, 'ABC Limited', 'receivable'));
      setDebtorSide(one(debtor, 'Begüm Teknoloji', 'payable'));
    }
    setSettings((current) => ({ ...current, asOfDate: '2026-06-30' }));
    setPeriodState({ start: '2026-01-01', end: '2026-06-30' });
    setActivePreset('custom');
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
    return {
      ...next,
      mapping,
      perspective: build.suggestedPerspective,
      columnHints: looksHeaderless(parsed) ? inferColumns(parsed) : null,
    };
  };

  const sideProps = (which: 'creditor' | 'debtor') => {
    const side = which === 'creditor' ? creditorSide : debtorSide;
    const setSide = which === 'creditor' ? setCreditorSide : setDebtorSide;
    const build = which === 'creditor' ? creditorBuild : debtorBuild;
    return {
      locale,
      title: t(`upload.${which}`),
      hint: t(`upload.${which}Hint`),
      partyName:
        side.partyName || (which === 'creditor' ? suggestPartyName(creditorSide, debtorSide) : suggestPartyName(debtorSide, creditorSide)) || '',
      onPartyName: (name: string) => setSide((s) => ({ ...s, partyName: name })),
      sources: build.views,
      totalEntries: build.entries.length,
      // Choosing a sheet is also the answer to "which sheet?", so the
      // question stops being asked the moment it is answered.
      onSheetIndex: (id: string, index: number) => {
        updateSource(which, id, (source) =>
          reguess(source, {
            sheetIndex: index,
            headerRow: source.workbook?.sheets[index]?.suggestedHeaderRow ?? 0,
            sheetConfirmed: true,
          }),
        );
        // Choosing "PAROS" out of a workbook says who this side is far better
        // than the file name does, so take it unless a name has been typed.
        setSide((current) => {
          const source = current.sources.find((item) => item.id === id);
          const sheetName = source?.workbook?.sheets[index]?.name?.trim();
          if (!sheetName || /^(sayfa|sheet|tablo)\s*\d*$/i.test(sheetName)) return current;
          const untouched =
            current.partyName === '' ||
            current.sources.some(
              (item) => item.workbook?.fileName.replace(/\.[^.]+$/, '') === current.partyName,
            );
          return untouched ? { ...current, partyName: sheetName } : current;
        });
      },
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
    side.sources.every(
      (source) =>
        source.sheetConfirmed &&
        validateMapping(source.mapping).every((issue) => issue.severity !== 'error'),
    );

  const canRun = hasBoth && mappingsUsable(creditorSide) && mappingsUsable(debtorSide);

  /** Questions the app is waiting on, counted so the tab can show them. */
  const unanswered = [...creditorSide.sources, ...debtorSide.sources].filter(
    (source) =>
      !source.sheetConfirmed ||
      validateMapping(source.mapping).some((issue) => issue.severity === 'error'),
  ).length;

  const run = () => {
    if (!canRun) return;
    const creditor: Party = {
      id: 'creditor',
      name: creditorName,
      taxId: firstTaxId(debtorSide) ?? null,
    };
    const debtor: Party = {
      id: 'debtor',
      name: debtorName,
      taxId: firstTaxId(creditorSide) ?? null,
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
      statedPeriodOf(creditorSide),
    );
    const debtorStatement = makeStatement(
      'debtor',
      label(debtorBuild),
      debtorBuild.entries,
      debtor.id,
      creditor.id,
      'receivable',
      statedPeriodOf(debtorSide),
    );

    setResult(
      reconcilePair(creditor, debtor, creditorStatement, debtorStatement, {
        ...settings,
        requestedPeriod:
          period.start && period.end
            ? // The balance is agreed as of `asOfDate`, so the window can never
              // run past it: lines after that date belong to the next period.
              { start: period.start, end: minDate(period.end, settings.asOfDate) }
            : null,
      }),
    );
    setStep('result');
  };

  /**
   * Hands over a sample ekstre as a real file.
   *
   * Loading the built-in example shows what the app does; downloading the
   * file it was built from shows what the app *expects*, which is the
   * question somebody evaluating it actually has. The file that comes down
   * can be dropped straight back in.
   */
  const downloadSample = async (side: SampleSide) => {
    const blob = await buildSampleWorkbook(side);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = sampleWorkbookName(side);
    link.click();
    URL.revokeObjectURL(url);
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
          <span className="mark">
            Mutabakat<span className="mark-suffix">APP</span>
          </span>
          <span className="tag">cari hesap mutabakatı</span>
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
                <span className="step-label">{label}</span>
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
                      <button
                        className="ghost small"
                        type="button"
                        style={{ alignSelf: 'flex-start' }}
                        onClick={() => void downloadSample(which)}
                      >
                        ↓ {t('upload.downloadSample')}
                      </button>
                    </div>
                  </section>
                );
              })}
            </div>

            <section className="how">
              <h2>{t('how.title')}</h2>
              <p className="how-lead">{t('how.lead')}</p>
              <ol className="how-steps">
                {(['s1', 's2', 's3', 's4', 's5'] as const).map((key) => (
                  <li key={key}>
                    <h3>{t(`how.${key}`)}</h3>
                    <p>{t(`how.${key}b`)}</p>
                  </li>
                ))}
              </ol>

              <h3 className="how-terms-title">{t('how.termsTitle')}</h3>
              <dl className="how-terms">
                {(['t1', 't2', 't3', 't4'] as const).map((key) => (
                  <div key={key}>
                    <dt>{t(`how.${key}`)}</dt>
                    <dd>{t(`how.${key}b`)}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="what">
              <h2>{t('what.title')}</h2>
              <div className="what-grid">
                {(['bridge', 'cause', 'action'] as const).map((key) => (
                  <div className="what-item" key={key}>
                    <h3>{t(`what.${key}`)}</h3>
                    <p className="small muted">{t(`what.${key}Body`)}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="row">
              <button
                className="primary"
                type="button"
                disabled={!hasBoth}
                onClick={() => setStep('map')}
              >
                {t('upload.continue')}
              </button>
              <button className="ghost" type="button" onClick={() => loadSample('matched')}>
                {t('upload.sample')}
              </button>
              <button className="ghost" type="button" onClick={() => loadSample('periodMismatch')}>
                {t('upload.samplePeriod')}
              </button>
              {!hasBoth && <span className="faint">{t('upload.bothNeeded')}</span>}
            </div>
          </div>
        )}

        {step === 'map' && hasBoth && (
          <div className="stack">
            {/*
              Two things get set up here and they are not the same kind of
              question: which columns mean what, and which period is being
              reconciled. Stacking both on one page buried the second under
              the first, so each gets its own tab and neither scrolls the
              other off the screen.
            */}
            <div className="tabs setup-tabs">
              {SETUP_TABS.map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={setupTab === key}
                  onClick={() => setSetupTab(key)}
                >
                  {t(`setup.tab.${key}`)}
                  {key === 'sides' && unanswered > 0 && (
                    <span className="badge-dot" aria-hidden="true">
                      {unanswered}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {setupTab === 'sides' && (
              <div className="grid-2">
                <SideSetup {...sideProps('creditor')} />
                <SideSetup {...sideProps('debtor')} />
              </div>
            )}

            {setupTab === 'period' && (
            <section className="card">
              <div className="card-head">
                <h2>{t('settings.title')}</h2>
              </div>

              <div className="card-body stack">
                <div>
                  <div className="ask">{t('settings.askAsOf')}</div>
                  <div className="row" style={{ gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <label className="field">
                      {t('settings.asOf')}
                      <input
                        type="date"
                        value={settings.asOfDate}
                        onChange={(event) => setAsOf(event.target.value)}
                      />
                    </label>
                  </div>
                  <p className="faint small" style={{ margin: '6px 0 0' }}>
                    {t('settings.asOfHint')}
                  </p>
                </div>

                <div>
                  <div className="ask">{t('settings.askStart')}</div>
                  <div className="row" style={{ gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <label className="field">
                      {t('settings.periodStart')}
                      <input
                        type="date"
                        value={period.start}
                        onChange={(event) => setPeriod('start', event.target.value)}
                      />
                    </label>
                    <div className="seg presets">
                      {PERIOD_PRESETS.map((preset) => (
                        <button
                          key={preset.key}
                          type="button"
                          aria-pressed={activePreset === preset.key}
                          onClick={() => applyPreset(preset.key)}
                        >
                          {t(`settings.preset.${preset.key}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="faint small" style={{ margin: '6px 0 0' }}>
                    {t('settings.startHint', {
                      opening: formatDate(dayBefore(period.start), locale),
                    })}
                  </p>
                </div>

                <details className="advanced">
                  <summary>{t('settings.advanced')}</summary>
                  <div className="row" style={{ gap: 18, alignItems: 'flex-end', paddingTop: 10 }}>
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
                </details>
              </div>

            </section>
            )}

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
          <ResultView
            locale={locale}
            result={result}
            onRestart={restart}
            onBack={() => setStep('map')}
          />
        )}
      </main>
    </div>
  );
}
