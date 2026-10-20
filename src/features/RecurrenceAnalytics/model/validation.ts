import type { RecurrenceGroup, RecurrenceObservation, RecurrenceReport, RecurrenceWindow } from './types';
import { monthIndex, validWindow } from './window';

const record = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x) &&
  (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);
const keys = (x: Record<string, unknown>, expected: readonly string[]) =>
  Object.keys(x).length === expected.length && expected.every(key => Object.prototype.hasOwnProperty.call(x, key));
const label = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0;
const count = (x: unknown, max: number): x is number =>
  typeof x === 'number' && Number.isSafeInteger(x) && x >= 1 && x <= max;

export const groupKey = (group: RecurrenceGroup): string => JSON.stringify([
  group.dataset, group.level, group.identity.provenance, group.identity.value,
  group.level === 'similar_expense' ? group.title : null,
  group.level === 'similar_expense' ? group.recipient : null,
]);
const group = (x: unknown): RecurrenceGroup | null => {
  if (!record(x) || !record(x.identity) || !keys(x.identity, ['provenance', 'value']) ||
      x.identity.provenance !== 'label_only' || !label(x.identity.value)) return null;
  const identity = { provenance: 'label_only' as const, value: x.identity.value };
  if (x.level === 'category_or_source' && (x.dataset === 'expenses' || x.dataset === 'incomes') &&
      keys(x, ['dataset', 'level', 'identity'])) return { dataset: x.dataset, level: x.level, identity };
  if (x.dataset === 'expenses' && x.level === 'similar_expense' && label(x.title) && label(x.recipient) &&
      keys(x, ['dataset', 'level', 'identity', 'title', 'recipient'])) {
    return { dataset: x.dataset, level: x.level, identity, title: x.title, recipient: x.recipient };
  }
  return null;
};

/** The current controller can attest label_only identities only. Fail closed on
 * future/unknown provenance or coverage instead of inventing stronger evidence.
 * All-or-nothing: no raw response or partial observations escape this boundary. */
export const validateRecurrence = (value: unknown, requested: RecurrenceWindow, now = new Date()): RecurrenceReport | null => {
  if (!validWindow(requested, now) || !record(value) || !keys(value, ['version', 'window', 'coverage', 'observations']) ||
      value.version !== 'observations-v0' || !record(value.window) || !keys(value.window, ['startMonth', 'endMonthExclusive']) ||
      value.window.startMonth !== requested.startMonth || value.window.endMonthExclusive !== requested.endMonthExclusive ||
      !record(value.coverage) || !keys(value.coverage, ['source', 'historicalContinuity', 'atomicSnapshot', 'maxRecordsPerDataset']) ||
      value.coverage.source !== 'stored_records_only' || value.coverage.historicalContinuity !== 'unverified' ||
      value.coverage.atomicSnapshot !== false || value.coverage.maxRecordsPerDataset !== 1000 ||
      !Array.isArray(value.observations) || value.observations.length > 3000) return null;
  const start = monthIndex(requested.startMonth), end = monthIndex(requested.endMonthExclusive);
  if (start === null || end === null) return null;
  const observations: RecurrenceObservation[] = [];
  const seen = new Set<string>();
  const categories = new Map<string, RecurrenceObservation>();
  const totals = { expenses: 0, incomes: 0, similar: 0 };
  for (const x of value.observations) {
    if (!record(x) || !keys(x, ['group', 'operationCount', 'activeMonthCount', 'activeMonths', 'intervalsInMonths', 'longestConsecutiveMonths'])) return null;
    const identity = group(x.group);
    if (!identity || !count(x.operationCount, 1000) || !count(x.activeMonthCount, end - start) ||
        x.activeMonthCount > x.operationCount || !Array.isArray(x.activeMonths) || x.activeMonths.length !== x.activeMonthCount ||
        !Array.isArray(x.intervalsInMonths) || x.intervalsInMonths.length !== x.activeMonthCount - 1) return null;
    const months: string[] = [], intervals: number[] = [];
    let previous: number | null = null, streak = 1, longest = 1;
    for (const month of x.activeMonths) {
      const index = monthIndex(month);
      if (typeof month !== 'string' || index === null || index < start || index >= end || (previous !== null && index <= previous)) return null;
      if (previous !== null) {
        const gap = index - previous;
        if (x.intervalsInMonths[intervals.length] !== gap) return null;
        intervals.push(gap); streak = gap === 1 ? streak + 1 : 1; longest = Math.max(longest, streak);
      }
      months.push(month); previous = index;
    }
    if (x.longestConsecutiveMonths !== longest) return null;
    const key = groupKey(identity);
    if (seen.has(key)) return null;
    seen.add(key);
    const observation: RecurrenceObservation = { group: identity, operationCount: x.operationCount,
      activeMonthCount: x.activeMonthCount, activeMonths: months, intervalsInMonths: intervals, longestConsecutiveMonths: longest };
    observations.push(observation);
    const dataset = identity.level === 'similar_expense' ? 'similar' : identity.dataset;
    totals[dataset] += x.operationCount;
    if (totals[dataset] > 1000) return null;
    if (identity.dataset === 'expenses' && identity.level === 'category_or_source') categories.set(identity.identity.value, observation);
  }
  const similarCounts = new Map<string, number>();
  const similarMonths = new Map<string, Set<string>>();
  for (const x of observations) if (x.group.level === 'similar_expense') {
    const key = x.group.identity.value, parent = categories.get(key);
    const sum = (similarCounts.get(key) ?? 0) + x.operationCount;
    if (!parent || sum > parent.operationCount || x.activeMonths.some(month => !parent.activeMonths.includes(month))) return null;
    similarCounts.set(key, sum);
    const months = similarMonths.get(key) ?? new Set<string>();
    x.activeMonths.forEach(month => months.add(month));
    similarMonths.set(key, months);
  }
  for (const [key, parent] of categories) {
    const uncovered = parent.activeMonths.filter(month => !similarMonths.get(key)?.has(month)).length;
    if ((similarCounts.get(key) ?? 0) + uncovered > parent.operationCount) return null;
  }
  return { version: 'observations-v0', window: {
    startMonth: requested.startMonth, endMonthExclusive: requested.endMonthExclusive,
  }, coverage: {
    source: 'stored_records_only', historicalContinuity: 'unverified', atomicSnapshot: false, maxRecordsPerDataset: 1000,
  }, observations };
};
