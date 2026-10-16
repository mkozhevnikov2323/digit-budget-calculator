export type PeriodKind = 'month' | 'quarter' | 'year' | 'custom';
export type CalendarRange = { start: string; end: string };
export type PeriodSelection = CalendarRange & { kind: PeriodKind; year: number; month: number };
const DAY_MS = 86400000;

export const parseCalendarDate = (value: string): Date => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Укажите корректные даты периода.');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('Укажите корректные даты периода.');
  }
  return date;
};

export const getCalendarRange = (selection: PeriodSelection): CalendarRange => {
  if (selection.kind === 'custom') {
    toApiRange(selection);
    return { start: selection.start, end: selection.end };
  }
  if (!Number.isInteger(selection.year) || selection.year < 2020 || selection.year > 9998 ||
      !Number.isInteger(selection.month) || selection.month < 1 || selection.month > 12) {
    throw new Error('Укажите год от 2020 до 9998 и корректный месяц.');
  }
  const month = selection.kind === 'year' ? 0 : selection.kind === 'quarter'
    ? Math.floor((selection.month - 1) / 3) * 3 : selection.month - 1;
  const months = selection.kind === 'year' ? 12 : selection.kind === 'quarter' ? 3 : 1;
  return {
    start: new Date(Date.UTC(selection.year, month, 1)).toISOString().slice(0, 10),
    end: new Date(Date.UTC(selection.year, month + months, 1) - DAY_MS).toISOString().slice(0, 10),
  };
};

export const toApiRange = ({ start, end }: CalendarRange) => {
  const startDate = parseCalendarDate(start);
  const endDate = parseCalendarDate(end);
  if (startDate > endDate) throw new Error('Начальная дата не должна быть позже конечной.');
  return { startDate: startDate.toISOString(), endDate: new Date(endDate.getTime() + DAY_MS - 1).toISOString() };
};

export const currentPeriod = (now = new Date()): PeriodSelection => ({
  kind: 'month', year: now.getUTCFullYear(), month: now.getUTCMonth() + 1,
  start: now.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10),
});

export const shiftPeriod = (selection: PeriodSelection, direction: -1 | 1): PeriodSelection => {
  if (selection.kind === 'custom') return selection;
  const step = selection.kind === 'year' ? 12 : selection.kind === 'quarter' ? 3 : 1;
  const anchor = new Date(Date.UTC(selection.year, selection.month - 1 + step * direction, 1));
  return { ...selection, year: anchor.getUTCFullYear(), month: anchor.getUTCMonth() + 1 };
};

export const getGranularity = (range: CalendarRange, kind: PeriodKind): 'day' | 'month' =>
  kind === 'quarter' || kind === 'year' ||
  (parseCalendarDate(range.end).getTime() - parseCalendarDate(range.start).getTime()) / DAY_MS + 1 > 62
    ? 'month' : 'day';

export const calendarKeys = (range: CalendarRange, granularity: 'day' | 'month'): string[] => {
  toApiRange(range);
  const cursor = parseCalendarDate(range.start);
  const end = parseCalendarDate(range.end);
  if (granularity === 'month') cursor.setUTCDate(1);
  const keys: string[] = [];
  while (cursor <= end) {
    keys.push(cursor.toISOString().slice(0, granularity === 'month' ? 7 : 10));
    if (granularity === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
};
