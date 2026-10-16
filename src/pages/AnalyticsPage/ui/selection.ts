import {
  customPeriod, monthPeriod, previousMonthPeriod, quarterPeriod, yearPeriod,
  type CalendarPeriod, type PeriodResult,
} from 'features/FinancialAnalytics/model/period';

// UI state only. Calendar construction and validation belong to PR #6.
export type PeriodKind = 'month' | 'quarter' | 'year' | 'custom';
export type PeriodSelection = {
  kind: PeriodKind;
  year: string;
  month: number;
  start: string;
  end: string;
};

const selectionFromMonth = (period: CalendarPeriod): PeriodSelection => ({
  kind: 'month', year: String(Number(period.firstDate.slice(0, 4))),
  month: Number(period.firstDate.slice(5, 7)), start: period.firstDate, end: period.lastDate,
});

export const currentSelection = (today = new Date().toISOString().slice(0, 10)): PeriodSelection => {
  const result = monthPeriod(Number(today.slice(0, 4)), Number(today.slice(5, 7)));
  if (!result.ok) throw new Error('Current UTC date is outside the supported calendar');
  return selectionFromMonth(result.value);
};

export const previousSelection = (today = new Date().toISOString().slice(0, 10)): PeriodSelection | null => {
  const result = previousMonthPeriod(today);
  return result.ok ? selectionFromMonth(result.value) : null;
};

export const selectedPeriod = (value: PeriodSelection): PeriodResult => {
  if (value.kind === 'custom') return customPeriod(value.start, value.end);
  const year = /^\d{1,4}$/.test(value.year) ? Number(value.year) : NaN;
  if (value.kind === 'month') return monthPeriod(year, value.month);
  if (value.kind === 'quarter') return quarterPeriod(year, Math.floor((value.month - 1) / 3) + 1);
  return yearPeriod(year);
};

export const shiftSelection = (value: PeriodSelection, direction: -1 | 1): PeriodSelection | null => {
  if (value.kind === 'custom' || !selectedPeriod(value).ok) return null;
  const year = Number(value.year);
  let next: PeriodSelection;
  if (value.kind === 'year') next = { ...value, year: String(year + direction) };
  else {
    const monthIndex = year * 12 + value.month - 1 + direction * (value.kind === 'quarter' ? 3 : 1);
    next = { ...value, year: String(Math.floor(monthIndex / 12)), month: monthIndex % 12 + 1 };
  }
  return selectedPeriod(next).ok ? next : null;
};
