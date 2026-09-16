import type { Locale } from '../types';

const CURRENCY_SYMBOLS: Record<string, string> = {
  TRY: '₺', TL: '₺', EUR: '€', EURO: '€', USD: '$', GBP: '£',
};

function localeTag(locale: Locale): string {
  return locale === 'tr' ? 'tr-TR' : 'en-US';
}

/** Money, in the convention of the chosen interface language. */
export function formatMoney(value: number, locale: Locale, currency?: string): string {
  // A value that only rounds to zero should print as zero, not as "-0,00".
  const safe = Object.is(value, -0) || Math.abs(value) < 0.005 ? 0 : value;
  const text = new Intl.NumberFormat(localeTag(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
  if (!currency) return text;
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()] ?? currency;
  return `${text} ${symbol}`;
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(localeTag(locale)).format(value);
}

/** An ISO date shown the way the reader writes dates. */
export function formatDate(iso: string, locale: Locale): string {
  const parsed = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed)) return iso;
  return new Intl.DateTimeFormat(localeTag(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(parsed));
}
