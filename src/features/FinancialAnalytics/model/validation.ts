import { toAnalyticsQueryParams } from './apiRange';
import { rublesToKopecks, sumKopecks } from './money';
import { customPeriod, type CalendarPeriod } from './period';
import type {
  AnalyticsDataset, AnalyticsResult, ValidatedDataset, ValidatedExpense,
  ValidatedIncome, ValidatedTransaction,
} from './types';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// API Date validation, not date reinterpretation: date-only is UTC midnight;
// timestamps must include a timezone and at most millisecond precision. Validate
// the calendar prefix with the authoritative primitive before Date.parse, which
// would otherwise accept nonexistent February days by rolling them forward.
const operationTimestamp = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const calendar = customPeriod(value.slice(0, 10), value.slice(0, 10));
  if (!calendar.ok) return null;
  if (value.length === 10) return calendar.value.startInclusive;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || match[0] !== value || Number(match[2]) > 23 ||
      Number(match[3]) > 59 || Number(match[4]) > 59) return null;
  const zone = match[6];
  if (zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4, 6)) > 59)) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const validateDataset = <T extends ValidatedTransaction>(
  response: unknown,
  dataset: AnalyticsDataset,
  period: CalendarPeriod,
  adapt: (record: Record<string, unknown>, base: ValidatedTransaction) => AnalyticsResult<T>,
): AnalyticsResult<ValidatedDataset<T>> => {
  const params = toAnalyticsQueryParams(period);
  if (!params.ok) return params;
  if (!isObject(response) || !Array.isArray(response[dataset])) {
    return { ok: false, error: { code: 'invalid_response', dataset } };
  }
  const records = response[dataset];
  const { total, page, limit } = response;
  if (typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0 || page !== 1 ||
      typeof limit !== 'number' || !Number.isSafeInteger(limit) || limit < 0 || limit < records.length) {
    return { ok: false, error: { code: 'invalid_metadata', dataset } };
  }
  if (total !== records.length) return { ok: false, error: { code: 'incomplete_response', dataset } };

  const ids = new Set<string>();
  const snapshots: T[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record: unknown = records[index];
    if (!isObject(record)) return { ok: false, error: { code: 'invalid_record', dataset, index } };
    const id = record._id;
    if (typeof id !== 'string' || !id || /\s/.test(id)) {
      return { ok: false, error: { code: 'invalid_id', dataset, index } };
    }
    if (ids.has(id)) return { ok: false, error: { code: 'duplicate_id', dataset, index } };
    ids.add(id);
    const timestamp = operationTimestamp(record.date);
    if (timestamp === null) return { ok: false, error: { code: 'invalid_date', dataset, index } };
    if (timestamp < period.startInclusive || timestamp >= period.endExclusive) {
      return { ok: false, error: { code: 'outside_period', dataset, index } };
    }
    // GET contracts declare numeric amounts. Do not coerce malformed API strings,
    // even though the monetary primitive also supports decimal input strings.
    if (typeof record.amount !== 'number') {
      return { ok: false, error: { code: 'invalid_amount', dataset, index, cause: 'invalid_amount' } };
    }
    const money = rublesToKopecks(record.amount);
    if (!money.ok) return { ok: false, error: { code: 'invalid_amount', dataset, index, cause: money.error } };
    const normalized = adapt(record, { id, timestamp, kopecks: money.value });
    if (!normalized.ok) return { ok: false, error: { ...normalized.error, dataset, index } };
    snapshots.push(normalized.value);
  }
  const totalMoney = sumKopecks(snapshots.map((record) => record.kopecks));
  if (!totalMoney.ok) return { ok: false, error: { code: 'overflow', dataset, cause: totalMoney.error } };
  return { ok: true, value: { records: snapshots, totalKopecks: totalMoney.value } };
};

export const validateExpenseResponse = (
  response: unknown, period: CalendarPeriod,
): AnalyticsResult<ValidatedDataset<ValidatedExpense>> =>
  validateDataset(response, 'expenses', period, (record, base) => {
    if (record.category != null && typeof record.category !== 'string') {
      return { ok: false, error: { code: 'invalid_category' } };
    }
    return {
      ok: true,
      value: {
        ...base,
        category: typeof record.category === 'string' && record.category.trim() ? record.category.trim() : 'Без категории',
        isLoanIssuance: record.category === 'Выдача займа',
      },
    };
  });

export const validateIncomeResponse = (
  response: unknown, period: CalendarPeriod,
): AnalyticsResult<ValidatedDataset<ValidatedIncome>> =>
  validateDataset(response, 'incomes', period, (record, base) => {
    if (typeof record.source !== 'string' || !record.source.trim()) {
      return { ok: false, error: { code: 'invalid_source' } };
    }
    return { ok: true, value: { ...base, source: record.source } };
  });
