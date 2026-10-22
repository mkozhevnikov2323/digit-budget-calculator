import { loadCoherentHistory, loadRecordedMembership, type HistoryReadPort } from '../coherentHistory';
import { yearPeriod } from 'features/FinancialAnalytics/model/period';

const owner = 'a'.repeat(24), other = 'b'.repeat(24);
const checked = yearPeriod(2025); if (!checked.ok) throw Error('Fixture');
const period = checked.value;
type Dataset = 'expenses' | 'incomes';
type Row = { _id: string; owner: string; amount: number; date: string; category?: string; title?: string; recipient?: string; source?: string; comment?: string | null };
const row = (n: number, dataset: Dataset): Row => ({ _id: n.toString(16).padStart(24, '0'), owner, amount: 12.34,
  date: '2025-01-15T12:00:00.001Z', ...(dataset === 'expenses' ? { category: 'Транспорт', title: 'Fuel', recipient: 'Fictional' } : { source: 'Fictional' }) });
const decision = (r: Row, dataset: Dataset) => ({ version: 'classification-read-v1', dataset, operationId: r._id,
  status: 'unreviewed', storedState: null, decisionRevision: null, confirmed: null, consistency: 'observed_only_non_atomic' });
const facts = (r: Row, dataset: Dataset) => ({ amount: { format: 'binary64-roundtrip-decimal', value: Object.is(r.amount, -0) ? '-0' : String(r.amount) },
  dateEpochMs: Date.parse(r.date), date: r.date, ...(dataset === 'expenses' ? { category: r.category, title: r.title, recipient: r.recipient } : { source: r.source }),
  comment: !Object.prototype.hasOwnProperty.call(r, 'comment') ? { kind: 'missing' } : r.comment === null ? { kind: 'null' } : { kind: 'value', value: r.comment } });
const fixture = (expenses = 201, incomes = 1) => {
  const rows = { expenses: Array.from({ length: expenses }, (_, n) => row(n + 1, 'expenses')), incomes: Array.from({ length: incomes }, (_, n) => row(n + 1, 'incomes')) };
  const calls: Parameters<HistoryReadPort>[0][] = [];
  const port: HistoryReadPort = async req => {
    calls.push(req);
    if (req.method === 'GET') {
      const u = new URL(req.url, 'https://fictional.invalid'), dataset = u.pathname.slice(1) as Dataset, page = Number(u.searchParams.get('page'));
      return { total: rows[dataset].length, page, limit: 100, [dataset]: rows[dataset].slice((page - 1) * 100, page * 100).map(r => ({ ...r })) };
    }
    const body = req.body as { operations: { dataset: Dataset; operationId: string }[] };
    const operations = body.operations.map(op => { const r = rows[op.dataset].find(r => r._id === op.operationId); if (!r) throw Error('SOURCE_UNAVAILABLE');
      return { ...op, facts: facts(r, op.dataset), classification: decision(r, op.dataset) }; });
    return { version: 'classification-history-read-v1', window: { startInclusive: period.startInclusive, endExclusive: period.endExclusive },
      coverage: 'requested_identities_only', consistency: 'observed_only_non_atomic', returnedCount: operations.length, operations };
  };
  return { rows, calls, port };
};
const load = (port: HistoryReadPort, current = () => true) => loadCoherentHistory(port, owner, period, current, 'p12-test', () => Date.UTC(2026, 0, 2));
const unavailable = (promise: Promise<unknown>) => expect(promise).rejects.toThrow('COHERENT_HISTORY_UNAVAILABLE');

for (const action of ['insert', 'delete', 'total', 'duplicate', 'missing'] as const) it(`fails closed on ${action} between membership pages`, async () => {
  const f = fixture(); let pages = 0;
  await unavailable(load(async req => {
    if (req.method === 'GET' && req.url.startsWith('/expenses') && ++pages === 2) {
      if (action === 'insert') f.rows.expenses.push(row(999, 'expenses'));
      if (action === 'delete') f.rows.expenses.pop();
      if (action === 'duplicate') f.rows.expenses[100] = f.rows.expenses[0];
    }
    const result = await f.port(req);
    return pages === 2 && req.method === 'GET' ? { ...result as object, ...(action === 'total' ? { total: 202 } : action === 'missing' ? { expenses: [] } : {}) } : result;
  }));
  expect(f.calls.some(r => r.method === 'POST')).toBe(false);
});

for (const [label, dataset, edit] of [
  ['expense amount', 'expenses', (r: Row) => { r.amount = 45.67; }],
  ['income amount', 'incomes', (r: Row) => { r.amount = 45.67; }],
  ['category', 'expenses', (r: Row) => { r.category = 'Ремонт'; }],
  ['title', 'expenses', (r: Row) => { r.title = 'Repair'; }],
  ['recipient', 'expenses', (r: Row) => { r.recipient = 'Other'; }],
  ['income source', 'incomes', (r: Row) => { r.source = 'Other'; }],
  ['comment missing to null', 'expenses', (r: Row) => { r.comment = null; }],
  ['comment missing to empty', 'expenses', (r: Row) => { r.comment = ''; }],
  ['Unicode normalization', 'expenses', (r: Row) => { r.category = 'e\u0301'; }],
  ['outside period', 'expenses', (r: Row) => { r.date = '2026-01-01T00:00:00.000Z'; }],
] as const) for (const phase of ['batch', 'final membership'] as const) it(`rejects ${label} observed at ${phase}`, async () => {
  const f = fixture(2, 2); f.rows.expenses[0].category = 'é'; let changed = false, batches = false;
  await unavailable(load(async req => {
    if (req.method === 'POST') batches = true;
    if (!changed && (phase === 'batch' ? req.method === 'POST' : batches && req.method === 'GET')) { edit(f.rows[dataset][0]); changed = true; }
    return f.port(req);
  }));
});

it('detects an operation entering the period at the final membership pass', async () => {
  const f = fixture(1, 0); let batched = false;
  await unavailable(load(async req => { if (req.method === 'POST') batched = true;
    if (batched && req.method === 'GET' && req.url.startsWith('/expenses') && f.rows.expenses.length === 1) f.rows.expenses.push(row(2, 'expenses'));
    return f.port(req);
  }));
});

it('retains equal-date deterministic identities, dataset collisions and exact optional facts', async () => {
  const f = fixture(101, 101); f.rows.expenses[0].comment = null; f.rows.expenses[1].comment = ''; f.rows.incomes[0].amount = -0;
  const c = await load(f.port);
  expect(c.history.operations).toHaveLength(202); expect(new Set(c.history.operations.map(r => r.dataset + '/' + r.operationId)).size).toBe(202);
  expect(Object.is(c.history.operations.find(r => r.dataset === 'incomes')?.facts.amount, -0)).toBe(true);
  expect(c.history.operations.filter(r => r.dataset === 'expenses').slice(0, 3).map(r => r.facts.comment)).toEqual([null, '', undefined]);
  expect(c.history.operations.every(Object.isFrozen)).toBe(true);
});

it('documents classification-only non-atomic observation without fabricating a second decision check', async () => {
  const f = fixture(1, 0); let revision = 1;
  const c = await load(async req => {
    const response = await f.port(req);
    if (req.method !== 'POST') return response;
    const result = response as { operations: { classification: ReturnType<typeof decision> }[] };
    const output = { ...result, operations: result.operations.map(op => ({ ...op, classification: { ...op.classification,
      status: 'explicit_unclassified', storedState: 'explicit_unclassified', decisionRevision: revision } })) };
    revision = 2; return output;
  });
  expect(revision).toBe(2); expect(c.decisions[0].decisionRevision).toBe(1); expect(c.consistency).toBe('observed_only_non_atomic');
  expect(c.history.operations[0].kopecks).toBe(1234);
});

for (const event of ['owner change', 'session generation', 'logout', 'cancel', 'period change'] as const) it(`refuses a late real-shaped response after ${event}`, async () => {
  const f = fixture(501, 1); let current = true, posts = 0;
  await unavailable(load(async req => { const r = await f.port(req); if (req.method === 'POST' && ++posts === 1) current = false; return r; }, () => current));
  expect(f.calls.filter(r => r.method === 'POST').length).toBeLessThanOrEqual(4);
});

for (const failure of ['network', 'deadline'] as const) it(`stops future batches after one ${failure} failure without publishing partial totals`, async () => {
  const f = fixture(1001, 0); let posts = 0, release!: () => void;
  const pause = new Promise<void>(resolve => { release = resolve; });
  const pending = load(async req => { if (req.method === 'POST') { posts++; if (posts === 1) throw Error(failure === 'deadline' ? 'REQUEST_DEADLINE' : 'REQUEST_UNAVAILABLE'); await pause; } return f.port(req); });
  await expect(pending).rejects.toThrow(); release(); await new Promise(resolve => setTimeout(resolve, 0));
  expect(posts).toBeLessThanOrEqual(4);
  expect(f.calls.filter(r => r.method === 'GET')).toHaveLength(12);
});

it('rejects the combined 50,001 cap immediately after metadata without downloading the remaining second dataset', async () => {
  const f = fixture(25001, 25000);
  await unavailable(load(f.port)); expect(f.calls.filter(r => r.url.startsWith('/incomes'))).toHaveLength(1);
  expect(f.calls.some(r => r.method === 'POST')).toBe(false);
});

for (const amount of [0.1 + 0.2, Number.NaN, Number.POSITIVE_INFINITY, -1, Number.MAX_SAFE_INTEGER]) it('fails closed on unsupported or overflowing money without rounding', async () => {
  const f = fixture(1, 0); f.rows.expenses[0].amount = amount; await unavailable(load(f.port));
});

it('fails closed on total overflow and cross-owner records before classification', async () => {
  for (const foreign of [true, false]) {
    const f = fixture(2, 0); if (foreign) f.rows.expenses[0].owner = other; else f.rows.expenses.forEach(r => { r.amount = 50000000000000; });
    await unavailable(loadRecordedMembership(f.port, owner, period, () => true)); expect(f.calls.some(r => r.method === 'POST')).toBe(false);
  }
});

it('accepts A→B→A and edits after final observation only as the documented observed-only guarantee', async () => {
  const f = fixture(1, 0);
  const c = await load(async req => { const r = await f.port(req); f.rows.expenses[0].amount = 99; f.rows.expenses[0].amount = 12.34; return r; });
  f.rows.expenses[0].amount = 99; expect(c.history.operations[0].kopecks).toBe(1234); expect(c.consistency).toBe('observed_only_non_atomic');
});
