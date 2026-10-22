import { toAnalyticsQueryParams } from 'features/FinancialAnalytics/model/apiRange';
import type { CalendarPeriod } from 'features/FinancialAnalytics/model/period';
import { closedData, canonicalId, validateClassificationRead, type ClassificationRead } from './contract';
import { validateOwnedHistory, type OwnedHistory, type HistoryOperation } from './history';

export const MAX_HISTORY_RECORDS = 50000;
const PAGE_SIZE = 100, BATCH_SIZE = 100, CONCURRENCY = 4;
type Dataset = 'expenses' | 'incomes';
type Identity = { dataset: Dataset; operationId: string };
export type CoherentHistory = { history: OwnedHistory; decisions: readonly ClassificationRead[];
  observedAt: number; observationId: string; consistency: 'observed_only_non_atomic' };
export type HistoryReadPort = (request: { url: string; method: 'GET' | 'POST'; body?: unknown; cache: 'no-store' }) => Promise<unknown>;
const invalid = (): never => { throw new Error('COHERENT_HISTORY_UNAVAILABLE'); };
const exactArray = (x: unknown, max: number): unknown[] | null => {
  if (!Array.isArray(x) || x.length > max || Reflect.ownKeys(x).length !== x.length + 1) return null;
  return x;
};
/** Authorized server facts, not a rounded preview. Negative zero remains in the
 * raw representation, even though zero kopecks are used for accounting. */
export const parseSourceFacts = (input: unknown, dataset: Dataset): HistoryOperation['facts'] | null => {
  const names = dataset === 'expenses' ? ['category', 'title', 'recipient'] : ['source'];
  const r = closedData(input, ['amount', 'dateEpochMs', 'date', 'comment', ...names]);
  const a = r && closedData(r.amount, ['format', 'value']), c = r && closedData(r.comment, ['kind', 'value']);
  if (!r || Object.keys(r).length !== names.length + 4 || !a || Object.keys(a).length !== 2
    || a.format !== 'binary64-roundtrip-decimal' || typeof a.value !== 'string' || a.value.length > 32
    || !c || typeof r.dateEpochMs !== 'number' || !Number.isSafeInteger(r.dateEpochMs)
    || r.dateEpochMs < -62135596800000 || r.dateEpochMs >= 253402300800000
    || typeof r.date !== 'string' || new Date(r.dateEpochMs).toISOString() !== r.date
    || !names.every(key => typeof r[key] === 'string' && (r[key] as string).length <= 8192)) return null;
  const amount = a.value === '-0' ? -0 : Number(a.value);
  if (!Number.isFinite(amount) || amount < 0 || (Object.is(amount, -0) ? '-0' : String(amount)) !== a.value) return null;
  if (c.kind === 'missing' || c.kind === 'null') { if (Object.keys(c).length !== 1) return null; }
  else if (c.kind !== 'value' || Object.keys(c).length !== 2 || typeof c.value !== 'string' || c.value.length > 8192) return null;
  return Object.freeze({ amount, date: r.date, ...(dataset === 'expenses'
    ? { category: r.category as string, title: r.title as string, recipient: r.recipient as string } : { source: r.source as string }),
    ...(c.kind === 'missing' ? {} : { comment: c.kind === 'null' ? null : c.value as string }) });
};
const sameOperation = (a: HistoryOperation, b: HistoryOperation): boolean => a.dataset === b.dataset
  && a.operationId === b.operationId && a.timestamp === b.timestamp && a.kopecks === b.kopecks
  && Object.is(a.facts.amount, b.facts.amount) && JSON.stringify(a.facts) === JSON.stringify(b.facts);

/** Multiple bounded reads, NOT an atomic snapshot. The second membership/facts
 * pass detects observable changes; edits after it and A→B→A remain possible. */
export const loadCoherentHistory = async (port: HistoryReadPort, owner: string, period: CalendarPeriod,
  current: () => boolean, observationId: string, now: () => number = Date.now): Promise<CoherentHistory> => {
  const params = toAnalyticsQueryParams(period);
  if (!params.ok || !canonicalId(owner) || !current()) return invalid();
  const call: HistoryReadPort = async request => {
    if (!current()) return invalid();
    const result = await port(request);
    if (!current()) return invalid();
    return result;
  };
  const membership = async (): Promise<OwnedHistory> => {
    const payloads: Record<Dataset, unknown> = { expenses: null, incomes: null };
    let overall = 0;
    for (const dataset of ['expenses', 'incomes'] as const) {
      const records: unknown[] = []; let total: number | undefined;
      for (let page = 1; ; page++) {
        const suffix = new URLSearchParams({ startDate: params.value.startDate, endDate: params.value.endDate,
          page: String(page), limit: String(PAGE_SIZE) });
        const r = closedData(await call({ url: `/${dataset}?${suffix}`, method: 'GET', cache: 'no-store' }), ['total', 'page', 'limit', dataset]);
        const items = r && exactArray(r[dataset], PAGE_SIZE);
        if (!r || !items || r.page !== page || r.limit !== PAGE_SIZE || typeof r.total !== 'number'
          || !Number.isSafeInteger(r.total) || r.total < 0 || r.total > MAX_HISTORY_RECORDS
          || (total !== undefined && r.total !== total)) return invalid();
        total = r.total;
        if (items.length !== Math.min(PAGE_SIZE, Math.max(0, total - records.length))) return invalid();
        records.push(...items);
        if (records.length === total) break;
      }
      overall += records.length;
      if (overall > MAX_HISTORY_RECORDS) return invalid();
      payloads[dataset] = { total: records.length, page: 1, limit: records.length, [dataset]: records };
    }
    const checked = validateOwnedHistory(payloads.expenses, payloads.incomes, period, owner);
    return checked.ok ? checked.value : invalid();
  };
  const before = await membership(), identities: Identity[] = before.operations.map(({ dataset, operationId }) => ({ dataset, operationId }));
  const results = new Map<string, { operation: HistoryOperation; decision: ClassificationRead }>();
  let nextBatch = 0;
  const batches: Identity[][] = [];
  for (let start = 0; start < identities.length; start += BATCH_SIZE) batches.push(identities.slice(start, start + BATCH_SIZE));
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, async () => {
    while (nextBatch < batches.length) {
      const batch = batches[nextBatch++];
      const r = closedData(await call({ url: '/classifications/history/read', method: 'POST', cache: 'no-store', body: {
        version: 'classification-history-read-request-v1', startInclusive: period.startInclusive, endExclusive: period.endExclusive, operations: batch,
      } }), ['version', 'window', 'coverage', 'consistency', 'returnedCount', 'operations']);
      const w = r && closedData(r.window, ['startInclusive', 'endExclusive']), operations = r && exactArray(r.operations, BATCH_SIZE);
      if (!r || Object.keys(r).length !== 6 || !w || Object.keys(w).length !== 2 || w.startInclusive !== period.startInclusive
        || w.endExclusive !== period.endExclusive || r.version !== 'classification-history-read-v1' || r.coverage !== 'requested_identities_only'
        || r.consistency !== 'observed_only_non_atomic' || !operations || r.returnedCount !== batch.length || operations.length !== batch.length) return invalid();
      const requested = new Set(batch.map(op => `${op.dataset}/${op.operationId}`));
      for (const item of operations) {
        const op = closedData(item, ['dataset', 'operationId', 'facts', 'classification']);
        if (!op || Object.keys(op).length !== 4 || (op.dataset !== 'expenses' && op.dataset !== 'incomes') || !canonicalId(op.operationId)) return invalid();
        const key = `${op.dataset}/${op.operationId}`, facts = parseSourceFacts(op.facts, op.dataset);
        const decision = validateClassificationRead(op.classification, op.dataset, op.operationId);
        if (!requested.has(key) || results.has(key) || !facts || !decision) return invalid();
        const record = { _id: op.operationId, owner, ...facts };
        const e = op.dataset === 'expenses' ? [record] : [], i = op.dataset === 'incomes' ? [record] : [];
        const checked = validateOwnedHistory({ expenses: e, total: e.length, page: 1, limit: e.length },
          { incomes: i, total: i.length, page: 1, limit: i.length }, period, owner);
        if (!checked.ok) return invalid();
        results.set(key, { operation: checked.value.operations[0], decision });
      }
    }
  }));
  const after = await membership();
  if (after.operations.length !== before.operations.length || results.size !== identities.length || !current()) return invalid();
  const operations: HistoryOperation[] = [], decisions: ClassificationRead[] = [];
  for (let index = 0; index < before.operations.length; index++) {
    const initial = before.operations[index], result = results.get(`${initial.dataset}/${initial.operationId}`);
    if (!result || !sameOperation(initial, after.operations[index]) || !sameOperation(result.operation, after.operations[index])) return invalid();
    operations.push(result.operation); decisions.push(result.decision);
  }
  return { history: { owner, period, operations: Object.freeze(operations) }, decisions: Object.freeze(decisions),
    observedAt: now(), observationId, consistency: 'observed_only_non_atomic' };
};
