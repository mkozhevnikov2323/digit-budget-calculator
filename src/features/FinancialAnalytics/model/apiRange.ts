import { customPeriod, type CalendarPeriod } from './period';
import type { AnalyticsResult } from './types';

export type AnalyticsQueryParams = {
  readonly startDate: string;
  readonly endDate: string;
  readonly noPagination: true;
};

/** Adapter for the current backend's $gte / $lte contract, not a new calendar
 * engine. Period construction stays in period.ts; UTC remains provisional.
 */
export const toAnalyticsQueryParams = (period: CalendarPeriod): AnalyticsResult<AnalyticsQueryParams> => {
  if (!period || typeof period !== 'object') return { ok: false, error: { code: 'invalid_period' } };
  const checked = customPeriod(period.firstDate, period.lastDate);
  if (!checked.ok) return { ok: false, error: { code: 'invalid_period', cause: checked.error } };
  if (period.startInclusive !== checked.value.startInclusive ||
      period.endExclusive !== checked.value.endExclusive) {
    return { ok: false, error: { code: 'invalid_period', cause: 'invalid_range' } };
  }
  return {
    ok: true,
    value: {
      startDate: new Date(checked.value.startInclusive).toISOString(),
      endDate: new Date(checked.value.endExclusive - 1).toISOString(),
      noPagination: true,
    },
  };
};
