import { monthPeriod, type CalendarPeriod } from './period';

/** Calendar elapsedness is not evidence that every real-world operation was recorded. */
export const historyMonthStatus = (key: string, period: CalendarPeriod, observedAt: number):
  'elapsed' | 'partial_period' | 'current_partial' | 'future' | 'unavailable' => {
  const month = monthPeriod(Number(key.slice(0, 4)), Number(key.slice(5, 7)));
  if (!month.ok || key !== month.value.firstDate.slice(0, 7) || !Number.isSafeInteger(observedAt)) return 'unavailable';
  if (month.value.startInclusive > observedAt) return 'future';
  if (month.value.endExclusive > observedAt) return 'current_partial';
  if (period.startInclusive > month.value.startInclusive || period.endExclusive < month.value.endExclusive) return 'partial_period';
  return 'elapsed';
};
