/**
 * Provisional UTC calendar convention for isolated analytics primitives.
 * Inputs are CE calendar dates YYYY-MM-DD, years 0001–9999 (a representation
 * boundary, not a product minimum such as 2020). No implicit "today" or host TZ.
 * Not a reporting-timezone decision, API adapter, or transaction-date migration.
 */
export type CalendarPeriod = {
  readonly firstDate: string;
  readonly lastDate: string;
  /** UTC epoch milliseconds, inclusive. */
  readonly startInclusive: number;
  /** UTC epoch milliseconds at the next day's start, exclusive. */
  readonly endExclusive: number;
};

export type PeriodError =
  | 'invalid_date'
  | 'invalid_year'
  | 'invalid_month'
  | 'invalid_quarter'
  | 'invalid_range';

export type PeriodResult<T = CalendarPeriod> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: PeriodError };

type CalendarDate = { year: number; month: number; day: number };

const validYear = (year: number) => Number.isInteger(year) && year >= 1 && year <= 9999;
const validMonth = (month: number) => Number.isInteger(month) && month >= 1 && month <= 12;

const daysInMonth = (year: number, month: number): number => {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
};

const parseDate = (input: string): CalendarDate | null => {
  if (typeof input !== 'string' || input.length !== 10) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!validYear(year) || !validMonth(month) || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }
  return { year, month, day };
};

const dateKey = (year: number, month: number, day: number): string =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

// Unlike Date.UTC(year, ...), setUTCFullYear does not remap years 1–99 to 1901–1999.
// Only validated dates, or an intentional next-day boundary, reach this helper.
const utcMidnight = ({ year, month, day }: CalendarDate): number => {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getTime();
};

/** Both selected dates are inclusive. Invalid or reversed input is explicit. */
export const customPeriod = (firstDate: string, lastDate: string): PeriodResult => {
  const first = parseDate(firstDate);
  const last = parseDate(lastDate);
  if (!first || !last) return { ok: false, error: 'invalid_date' };
  const startInclusive = utcMidnight(first);
  const lastMidnight = utcMidnight(last);
  if (startInclusive > lastMidnight) return { ok: false, error: 'invalid_range' };
  return {
    ok: true,
    value: {
      firstDate,
      lastDate,
      startInclusive,
      endExclusive: utcMidnight({ ...last, day: last.day + 1 }),
    },
  };
};

/** Full month; month is 1-based. */
export const monthPeriod = (year: number, month: number): PeriodResult => {
  if (!validYear(year)) return { ok: false, error: 'invalid_year' };
  if (!validMonth(month)) return { ok: false, error: 'invalid_month' };
  return customPeriod(dateKey(year, month, 1), dateKey(year, month, daysInMonth(year, month)));
};

/** Full previous month relative to an explicitly supplied calendar date. */
export const previousMonthPeriod = (referenceDate: string): PeriodResult => {
  const date = parseDate(referenceDate);
  if (!date) return { ok: false, error: 'invalid_date' };
  return date.month === 1 ? monthPeriod(date.year - 1, 12) : monthPeriod(date.year, date.month - 1);
};

/** Full calendar quarter; quarter is 1–4, independent of the current date. */
export const quarterPeriod = (year: number, quarter: number): PeriodResult => {
  if (!validYear(year)) return { ok: false, error: 'invalid_year' };
  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    return { ok: false, error: 'invalid_quarter' };
  }
  const lastMonth = quarter * 3;
  return customPeriod(
    dateKey(year, lastMonth - 2, 1),
    dateKey(year, lastMonth, daysInMonth(year, lastMonth)),
  );
};

/** Full year; an end boundary in year 10000 is valid for selected year 9999. */
export const yearPeriod = (year: number): PeriodResult => {
  if (!validYear(year)) return { ok: false, error: 'invalid_year' };
  return customPeriod(dateKey(year, 1, 1), dateKey(year, 12, 31));
};

/** Ordered YYYY-MM keys for every touched month, independent of transactions.
 * Validate the complete supplied period so inconsistent boundaries cannot be
 * silently trusted. Returns a new array; neither the period nor data is mutated.
 */
export const monthKeys = (period: CalendarPeriod): PeriodResult<readonly string[]> => {
  const checked = customPeriod(period.firstDate, period.lastDate);
  if (!checked.ok) return checked;
  if (period.startInclusive !== checked.value.startInclusive ||
      period.endExclusive !== checked.value.endExclusive) {
    return { ok: false, error: 'invalid_range' };
  }
  const first = new Date(period.startInclusive);
  const last = new Date(period.endExclusive - 1);
  const start = first.getUTCFullYear() * 12 + first.getUTCMonth();
  const end = last.getUTCFullYear() * 12 + last.getUTCMonth();
  const keys: string[] = [];
  for (let index = start; index <= end; index += 1) {
    keys.push(`${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}`);
  }
  return { ok: true, value: keys };
};
