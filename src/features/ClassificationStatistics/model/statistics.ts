import { sumKopecks } from 'features/FinancialAnalytics/model/money';
import { monthKeys, type CalendarPeriod } from 'features/FinancialAnalytics/model/period';
import { toAnalyticsQueryParams } from 'features/FinancialAnalytics/model/apiRange';
import { historyMonthStatus } from 'features/FinancialAnalytics/model/historyCoverage';
import { FINANCIAL_LAYERS, type FinancialLayer } from 'features/FinancialClassification/model/types';
import { closedData, canonicalId, validateClassificationRead, STABLE_TAXONOMY,
  type ClassificationStatus, type StableRole } from 'features/HistoricalClassification/model/contract';

export type Bucket = { kopecks: number; count: number };
export const STATUSES: readonly ClassificationStatus[] = ['approved', 'unreviewed', 'explicit_unclassified', 'cleared', 'stale', 'blocked'];
export type DatasetStatistics = { recorded: Bucket; statuses: Record<ClassificationStatus, Bucket>;
  roles: Partial<Record<StableRole, Bucket>>; layers: Record<FinancialLayer, Bucket>;
  coverage: { byCount: number | null; byAmount: number | null } };
export type RecordingEvidence = 'complete' | 'missing' | 'unverified';
export type ClassifiedHistory = Readonly<{ version: 'classification-statistics-v1'; origin: 'synthetic' | 'coherent_adapter';
  taxonomyVersion: typeof STABLE_TAXONOMY; owner: string; period: CalendarPeriod; observedAt: number;
  expenses: DatasetStatistics; incomes: DatasetStatistics;
  months: readonly { key: string; recording: RecordingEvidence; calendar: ReturnType<typeof historyMonthStatus>;
    expenses: DatasetStatistics; incomes: DatasetStatistics }[];
  reconciliation: { expenseAmount: true; expenseCount: true; incomeAmount: true; incomeCount: true } }>;
export type StatisticsResult = { ok: true; value: ClassifiedHistory } | { ok: false; error: { code:
  'invalid_input' | 'invalid_period' | 'duplicate_operation' | 'scope_mismatch' | 'incomplete_classification'
  | 'source_observation_mismatch' | 'invalid_decision' | 'overflow' } };
const fail = (code: Extract<StatisticsResult, { ok: false }>['error']['code']): StatisticsResult => ({ ok: false, error: { code } });
const has = (x: object, k: string) => Object.prototype.hasOwnProperty.call(x, k);
const bucket = (): Bucket => ({ kopecks: 0, count: 0 });
const fresh = (): DatasetStatistics => ({ recorded: bucket(), statuses: Object.fromEntries(STATUSES.map(s => [s, bucket()])) as Record<ClassificationStatus, Bucket>,
  roles: {}, layers: Object.fromEntries(FINANCIAL_LAYERS.map(s => [s, bucket()])) as Record<FinancialLayer, Bucket>, coverage: { byCount: null, byAmount: null } });
/** Descriptor-only bounded arrays. No document/coercion callbacks. */
export const dataArray = (input: unknown, max: number): unknown[] | null => {
  try {
    if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype || input.length > max
      || Reflect.ownKeys(input).length !== input.length + 1) return null;
    const out: unknown[] = [];
    for (let i = 0; i < input.length; i++) {
      const d = Object.getOwnPropertyDescriptor(input, String(i));
      if (!d || !d.enumerable || !has(d, 'value')) return null;
      out.push(d.value);
    }
    return out;
  } catch { return null; }
};
const observation = (x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length <= 128 && !/\s/.test(x);

/** Pure accounting, not authentication or source attestation. P5/P7's trusted
 * coherent adapter establishes bindings; a separate C3.2 GET cannot. */
export const buildClassificationStatistics = (input: unknown): StatisticsResult => {
  const r = closedData(input, ['version', 'origin', 'taxonomyVersion', 'owner', 'period', 'observedAt', 'operations', 'decisions', 'monthEvidence']);
  if (!r || r.version !== 'classification-statistics-input-v1' || r.taxonomyVersion !== STABLE_TAXONOMY
    || (r.origin !== 'synthetic' && r.origin !== 'coherent_adapter') || !canonicalId(r.owner)
    || typeof r.observedAt !== 'number' || !Number.isSafeInteger(r.observedAt)
    || !Number.isFinite(new Date(r.observedAt).getTime())) return fail('invalid_input');
  const p = closedData(r.period, ['firstDate', 'lastDate', 'startInclusive', 'endExclusive']);
  if (!p || typeof p.firstDate !== 'string' || typeof p.lastDate !== 'string'
    || typeof p.startInclusive !== 'number' || typeof p.endExclusive !== 'number') return fail('invalid_period');
  const period = { firstDate: p.firstDate, lastDate: p.lastDate, startInclusive: p.startInclusive, endExclusive: p.endExclusive };
  if (!toAnalyticsQueryParams(period).ok) return fail('invalid_period');
  const keys = monthKeys(period);
  if (!keys.ok || keys.value.length > 120) return fail('invalid_period');
  const operations = dataArray(r.operations, 50000), decisions = dataArray(r.decisions, 50000), evidence = dataArray(r.monthEvidence, 120);
  if (!operations || !decisions || !evidence) return fail('invalid_input');
  if (decisions.length !== operations.length || evidence.length !== keys.value.length) return fail('incomplete_classification');
  const months = keys.value.map(key => ({ key, recording: 'unverified' as RecordingEvidence,
    calendar: historyMonthStatus(key, period, r.observedAt as number), expenses: fresh(), incomes: fresh() }));
  const byMonth = new Map(months.map(m => [m.key, m]));
  const seenEvidence = new Set<string>();
  for (const item of evidence) {
    const e = closedData(item, ['key', 'recording']);
    if (!e || typeof e.key !== 'string' || !['complete', 'missing', 'unverified'].some(s => s === e.recording)
      || seenEvidence.has(e.key) || !byMonth.has(e.key)) return fail('invalid_input');
    seenEvidence.add(e.key); byMonth.get(e.key)!.recording = e.recording as RecordingEvidence;
  }
  const reads = new Map<string, { observation: string; read: NonNullable<ReturnType<typeof validateClassificationRead>> }>();
  for (const item of decisions) {
    const d = closedData(item, ['owner', 'dataset', 'operationId', 'sourceObservationId', 'read']);
    if (!d || d.owner !== r.owner || (d.dataset !== 'expenses' && d.dataset !== 'incomes') || !canonicalId(d.operationId)) return fail('scope_mismatch');
    const read = validateClassificationRead(d.read, d.dataset, d.operationId), key = `${d.dataset}/${d.operationId}`;
    if (!read || !observation(d.sourceObservationId)) return fail('invalid_decision');
    if (reads.has(key)) return fail('incomplete_classification');
    reads.set(key, { observation: d.sourceObservationId, read });
  }
  const totals = { expenses: fresh(), incomes: fresh() }, seen = new Set<string>();
  const add = (b: Bucket, amount: number): boolean => {
    const total = sumKopecks([b.kopecks, amount]); if (!total.ok) return false;
    b.kopecks = total.value; b.count++; return true;
  };
  for (const item of operations) {
    const op = closedData(item, ['owner', 'dataset', 'operationId', 'timestamp', 'kopecks', 'sourceObservationId']);
    if (!op || op.owner !== r.owner || (op.dataset !== 'expenses' && op.dataset !== 'incomes') || !canonicalId(op.operationId)) return fail('scope_mismatch');
    if (typeof op.timestamp !== 'number' || !Number.isSafeInteger(op.timestamp) || op.timestamp < period.startInclusive || op.timestamp >= period.endExclusive
      || typeof op.kopecks !== 'number' || !Number.isSafeInteger(op.kopecks) || op.kopecks < 0 || !observation(op.sourceObservationId)) return fail('invalid_input');
    const key = `${op.dataset}/${op.operationId}`, decision = reads.get(key);
    if (seen.has(key)) return fail('duplicate_operation'); seen.add(key);
    if (!decision) return fail('incomplete_classification');
    if (decision.observation !== op.sourceObservationId) return fail('source_observation_mismatch');
    const month = byMonth.get(new Date(op.timestamp).toISOString().slice(0, 7));
    if (!month) return fail('invalid_period');
    for (const target of [totals[op.dataset], month[op.dataset]]) {
      if (!add(target.recorded, op.kopecks) || !add(target.statuses[decision.read.status], op.kopecks)) return fail('overflow');
      const assignment = decision.read.confirmed;
      if (decision.read.status === 'approved' && assignment) {
        const b = target.roles[assignment.economicRole] ??= bucket();
        if (!add(b, op.kopecks)) return fail('overflow');
        if (assignment.economicRole === 'ordinary_expense' && assignment.layer && !add(target.layers[assignment.layer], op.kopecks)) return fail('overflow');
      }
    }
  }
  for (const target of [totals.expenses, totals.incomes, ...months.flatMap(m => [m.expenses, m.incomes])]) {
    const amount = sumKopecks(STATUSES.map(s => target.statuses[s].kopecks));
    if (!amount.ok || amount.value !== target.recorded.kopecks || STATUSES.reduce((n, s) => n + target.statuses[s].count, 0) !== target.recorded.count) return fail('overflow');
    target.coverage = { byCount: target.recorded.count ? target.statuses.approved.count / target.recorded.count : null,
      byAmount: target.recorded.kopecks ? target.statuses.approved.kopecks / target.recorded.kopecks : null };
  }
  return { ok: true, value: { version: 'classification-statistics-v1', origin: r.origin, taxonomyVersion: STABLE_TAXONOMY,
    owner: r.owner, period, observedAt: r.observedAt, ...totals, months,
    reconciliation: { expenseAmount: true, expenseCount: true, incomeAmount: true, incomeCount: true } } };
};
