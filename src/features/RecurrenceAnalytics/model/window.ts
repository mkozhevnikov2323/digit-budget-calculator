import { monthPeriod } from 'features/FinancialAnalytics/model/period';
import type { RecurrenceWindow } from './types';

export type RecurrenceLookback = 3 | 6 | 12;
export const monthIndex = (value: unknown): number | null => {
  if (typeof value !== 'string' || value.length !== 7 || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const year = Number(value.slice(0, 4)), month = Number(value.slice(5));
  return monthPeriod(year, month).ok ? year * 12 + month - 1 : null;
};
const monthText = (index: number): string =>
  `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}`;

export const previousCompletedMonths = (months: RecurrenceLookback, now = new Date()): RecurrenceWindow | null => {
  if (![3, 6, 12].includes(months) || !Number.isFinite(now.getTime())) return null;
  const end = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const window = { startMonth: monthText(end - months), endMonthExclusive: monthText(end) };
  return monthIndex(window.startMonth) !== null && monthIndex(window.endMonthExclusive) !== null ? window : null;
};

export const validWindow = (window: RecurrenceWindow, now = new Date()): boolean => {
  const start = monthIndex(window.startMonth), end = monthIndex(window.endMonthExclusive);
  const current = now.getUTCFullYear() * 12 + now.getUTCMonth();
  return start !== null && end !== null && Number.isFinite(current) && end > start && end - start <= 12 && end <= current;
};
