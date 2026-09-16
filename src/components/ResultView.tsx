import { useMemo, useState } from 'react';
import type { AgingBucket, Locale, MatchedPair, PairReconciliation, UnmatchedEntry } from '../types';
import { translate } from '../lib/i18n';
import { formatDate, formatMoney } from '../lib/formatters';
import { exportReconciliation } from '../lib/exportXlsx';

interface Props {
  locale: Locale;
  result: PairReconciliation;
  onRestart: () => void;
}

const BUCKETS: AgingBucket[] = ['notDue', 'd1to30', 'd31to60', 'd61to90', 'd90plus'];

type Tab = 'actions' | 'aging' | 'missing' | 'mismatch' | 'matched';

/**
 * Colour carries meaning here, so it is spent carefully.
 *
 * A difference is never good news, whichever way it points — painting a
 * 46.841,20 gap green because it happens to be positive would read as a
 * result rather than a problem. So differences are red when they exist and
 * plain when they are zero, and a plain amount stays plain; only a negative
 * claim, which genuinely means money moving the other way, is tinted.
 */
function diffClass(value: number): string {
  return Math.abs(value) < 0.005 ? '' : 'neg';
}

function claimClass(value: number): string {
  return value < -0.005 ? 'neg' : '';
}

export function ResultView({ locale, result, onRestart }: Props) {
  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const { bridge, match, allocation, actions, creditor, debtor, currency } = result;
  const [tab, setTab] = useState<Tab>('actions');
  const money = (value: number) => formatMoney(value, locale, currency);

  const mismatches = useMemo(
    () => match.pairs.filter((pair) => Math.abs(pair.amountDifference) >= 0.01),
    [match.pairs],
  );

  const buckets = useMemo(() => {
    const totals: Record<AgingBucket, number> = {
      notDue: 0, d1to30: 0, d31to60: 0, d61to90: 0, d90plus: 0,
    };
    for (const invoice of allocation.invoices) {
      if (invoice.open <= 0.01) continue;
      totals[invoice.bucket] += invoice.open;
    }
    return totals;
  }, [allocation.invoices]);

  const openInvoices = useMemo(
    () =>
      allocation.invoices
        .filter((invoice) => invoice.open > 0.01)
        .sort((a, b) => b.daysOverdue - a.daysOverdue || b.open - a.open),
    [allocation.invoices],
  );

  const download = async () => {
    const blob = await exportReconciliation(result, locale);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Mutabakat ${creditor.name} - ${debtor.name}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const bridgeRow = (
    label: string,
    a: number | null,
    b: number | null,
    diff: number | null,
    note?: string,
    emphasis = false,
  ) => (
    <tr className={emphasis ? 'emphasis' : undefined} key={label}>
      <td>{label}</td>
      <td className="n num">{a === null ? '' : money(a)}</td>
      <td className="n num">{b === null ? '' : money(b)}</td>
      <td className={`n num ${diff === null ? '' : diffClass(diff)}`}>
        {diff === null ? '' : money(diff)}
      </td>
      <td className="faint">{note ?? ''}</td>
    </tr>
  );

  const missingRows = (items: UnmatchedEntry[], side: 'creditor' | 'debtor') =>
    items.map((item) => {
      const action = actions.find((a) => a.entryIds.includes(item.entry.id));
      return (
        <tr key={`${side}-${item.entry.id}`}>
          <td>{formatDate(item.entry.date, locale)}</td>
          <td className="num">{item.entry.docNo || '—'}</td>
          <td>{item.entry.description}</td>
          <td className={`n num ${claimClass(item.claim)}`}>{money(item.claim)}</td>
          <td className="small muted">
            {action ? t(action.messageKey, action.messageVars) : ''}
          </td>
        </tr>
      );
    });

  const pairRows = (pairs: MatchedPair[]) =>
    pairs.map((pair) => (
      <tr key={`${pair.creditorEntry.id}-${pair.debtorEntry.id}`}>
        <td>{formatDate(pair.creditorEntry.date, locale)}</td>
        <td className="num">{pair.creditorEntry.docNo || pair.debtorEntry.docNo || '—'}</td>
        <td className="n num">{money(pair.creditorClaim)}</td>
        <td className="n num">{money(pair.debtorClaim)}</td>
        <td className={`n num ${diffClass(pair.amountDifference)}`}>
          {money(pair.amountDifference)}
        </td>
        <td className="small muted">{t(`basis.${pair.basis}`)}</td>
      </tr>
    ));

  return (
    <div className="stack">
      <div className={bridge.agreed ? 'verdict good' : 'verdict bad'}>
        <span className="badge">{bridge.agreed ? t('result.agreed') : t('result.notAgreed')}</span>
        <span className="detail">
          {bridge.agreed
            ? t('result.agreedHint')
            : t('result.notAgreedHint', { amount: money(bridge.residual) })}
        </span>
        <span className="spacer" style={{ flex: 1 }} />
        <button className="primary" onClick={download} type="button">
          {t('result.export')}
        </button>
        <button className="ghost" onClick={onRestart} type="button">
          {t('result.restart')}
        </button>
      </div>

      {!bridge.reconciles && <div className="notice error">{t('result.bridgeBroken')}</div>}

      <section className="card">
        <div className="card-head">
          <h2>SONUÇ TABLOSU</h2>
          <span className="spacer" />
          <span className="faint">{formatDate(result.asOfDate, locale)}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>İŞLEM / AÇIKLAMA</th>
              <th className="n">{t('result.figuresOf', { name: creditor.name })}</th>
              <th className="n">{t('result.figuresOf', { name: debtor.name })}</th>
              <th className="n">{t('table.diff')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {bridgeRow(
              t('result.balanceToday'),
              bridge.creditorBalance,
              bridge.debtorBalance,
              bridge.difference,
              t('result.balanceDiff'),
            )}
            {bridgeRow(
              t('result.opening'),
              bridge.creditorOpening,
              bridge.debtorOpening,
              bridge.openingDifference,
              t('result.openingDiff'),
            )}
            {bridgeRow(
              t('result.missingTotal'),
              bridge.debtorOnlyTotal,
              -bridge.creditorOnlyTotal,
              null,
            )}
            {bridgeRow(
              t('result.afterReconciliation'),
              bridge.creditorAdjusted,
              -bridge.debtorAdjusted,
              null,
              undefined,
              true,
            )}
            {bridgeRow(t('result.difference'), bridge.residual, null, null, undefined, true)}
          </tbody>
        </table>
      </section>

      <section className="card">
        <div className="card-head">
          <div className="tabs">
            {(
              [
                ['actions', t('result.actions'), actions.length],
                ['aging', t('result.aging'), openInvoices.length],
                ['missing', 'Eksik kayıtlar', match.creditorOnly.length + match.debtorOnly.length],
                ['mismatch', t('result.amountMismatch'), mismatches.length],
                ['matched', t('result.matched'), match.pairs.length],
              ] as [Tab, string, number][]
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
              >
                {label} <span className="faint">({count})</span>
              </button>
            ))}
          </div>
        </div>

        {tab === 'actions' &&
          (actions.length === 0 ? (
            <div className="empty">{t('result.noRows')}</div>
          ) : (
            <div>
              {actions.map((action) => (
                <div className={`action ${action.severity}`} key={action.id}>
                  <span className="pill">{t(`severity.${action.severity}`)}</span>
                  <div className="body">{t(action.messageKey, action.messageVars)}</div>
                  {Math.abs(action.amount) >= 0.01 && (
                    <div className="amount">{money(action.amount)}</div>
                  )}
                </div>
              ))}
            </div>
          ))}

        {tab === 'aging' && (
          <div className="stack card-body">
            <div className="buckets">
              {BUCKETS.map((bucket) => (
                <div
                  className={bucket === 'd90plus' && buckets[bucket] > 0 ? 'bucket hot' : 'bucket'}
                  key={bucket}
                >
                  <div className="label">{t(`aging.${bucket}`)}</div>
                  <div className="value">{money(buckets[bucket])}</div>
                </div>
              ))}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('table.date')}</th>
                    <th>{t('table.docNo')}</th>
                    <th>{t('table.dueDate')}</th>
                    <th className="n">{t('table.amount')}</th>
                    <th className="n">{t('table.open')}</th>
                    <th className="n">{t('table.daysOverdue')}</th>
                    <th>{t('table.bucket')}</th>
                  </tr>
                </thead>
                <tbody>
                  {openInvoices.map((invoice) => (
                    <tr key={invoice.entry.id}>
                      <td>{formatDate(invoice.entry.date, locale)}</td>
                      <td className="num">{invoice.entry.docNo || '—'}</td>
                      <td>
                        {formatDate(invoice.dueDate, locale)}
                        {invoice.dueDateSource === 'term' && <span className="faint"> *</span>}
                      </td>
                      <td className="n num">{money(invoice.amount)}</td>
                      <td className="n num">{money(invoice.open)}</td>
                      <td className={`n num ${invoice.daysOverdue > 0 ? 'neg' : ''}`}>
                        {invoice.daysOverdue > 0 ? invoice.daysOverdue : '—'}
                      </td>
                      <td>{t(`aging.${invoice.bucket}`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {openInvoices.length === 0 && <div className="empty">{t('result.noRows')}</div>}
          </div>
        )}

        {tab === 'missing' && (
          <div className="stack" style={{ gap: 0 }}>
            <div className="card-body tight">
              <h3>{t('result.creditorOnly', { creditor: creditor.name, debtor: debtor.name })}</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('table.date')}</th>
                    <th>{t('table.docNo')}</th>
                    <th>{t('table.description')}</th>
                    <th className="n">{t('table.amount')}</th>
                    <th>{t('result.explanation')}</th>
                  </tr>
                </thead>
                <tbody>{missingRows(match.creditorOnly, 'creditor')}</tbody>
              </table>
              {match.creditorOnly.length === 0 && <div className="empty">{t('result.noRows')}</div>}
            </div>
            <div className="card-body tight">
              <h3>{t('result.debtorOnly', { creditor: creditor.name, debtor: debtor.name })}</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('table.date')}</th>
                    <th>{t('table.docNo')}</th>
                    <th>{t('table.description')}</th>
                    <th className="n">{t('table.amount')}</th>
                    <th>{t('result.explanation')}</th>
                  </tr>
                </thead>
                <tbody>{missingRows(match.debtorOnly, 'debtor')}</tbody>
              </table>
              {match.debtorOnly.length === 0 && <div className="empty">{t('result.noRows')}</div>}
            </div>
          </div>
        )}

        {(tab === 'mismatch' || tab === 'matched') && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('table.date')}</th>
                  <th>{t('table.docNo')}</th>
                  <th className="n">{t('table.creditorAmount', { name: creditor.name })}</th>
                  <th className="n">{t('table.debtorAmount', { name: debtor.name })}</th>
                  <th className="n">{t('table.diff')}</th>
                  <th>{t('table.basis')}</th>
                </tr>
              </thead>
              <tbody>{pairRows(tab === 'mismatch' ? mismatches : match.pairs)}</tbody>
            </table>
            {(tab === 'mismatch' ? mismatches : match.pairs).length === 0 && (
              <div className="empty">{t('result.noRows')}</div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
