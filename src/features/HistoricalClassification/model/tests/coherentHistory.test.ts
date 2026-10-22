import { loadCoherentHistory, parseSourceFacts, type HistoryReadPort } from '../coherentHistory';
import { yearPeriod } from 'features/FinancialAnalytics/model/period';
const owner = 'a'.repeat(24);
const period = yearPeriod(2025); if (!period.ok) throw Error('Fixture');
const p = period.value;
const record = (n: number) => ({ _id: n.toString(16).padStart(24, '0'), owner, amount: 12.34,
  date: '2025-01-15T12:00:00.001Z', category: 'Транспорт', title: 'Fuel', recipient: 'Fictional' });
const read = (id: string) => ({ version: 'classification-read-v1', dataset: 'expenses', operationId: id,
  status: 'unreviewed', storedState: null, decisionRevision: null, confirmed: null, consistency: 'observed_only_non_atomic' });
const wire = (r = record(1)) => ({ amount: { format: 'binary64-roundtrip-decimal', value: String(r.amount) },
  dateEpochMs: Date.parse(r.date), date: r.date, category: r.category, title: r.title, recipient: r.recipient, comment: { kind: 'missing' } });
const transport = (count: number, mutate?: (value: Record<string, unknown>, call: number) => unknown) => {
  let calls = 0, active = 0, peak = 0;
  const fn = jest.fn<ReturnType<HistoryReadPort>, Parameters<HistoryReadPort>>(async req => {
    calls++; const at = calls;
    if (req.method === 'GET') {
      const url = new URL(req.url, 'https://fictional.invalid'), dataset = url.pathname.slice(1), page = Number(url.searchParams.get('page'));
      const rows = dataset === 'expenses' ? Array.from({ length: count }, (_, n) => record(n + 1)).slice((page - 1) * 100, page * 100) : [];
      const result = { [dataset]: rows, total: dataset === 'expenses' ? count : 0, page, limit: 100 };
      return mutate ? mutate(result, at) : result;
    }
    active++; peak = Math.max(peak, active); await Promise.resolve();
    const body = req.body as { operations: { dataset: string; operationId: string }[] };
    const operations = body.operations.map(op => ({ ...op, facts: wire(record(parseInt(op.operationId, 16))), classification: read(op.operationId) }));
    const result = { version: 'classification-history-read-v1', window: { startInclusive: p.startInclusive, endExclusive: p.endExclusive },
      coverage: 'requested_identities_only', consistency: 'observed_only_non_atomic', returnedCount: operations.length, operations };
    active--; return mutate ? mutate(result, at) : result;
  });
  return { fn, peak: () => peak };
};
const load = (port: HistoryReadPort, current = () => true) => loadCoherentHistory(port, owner, p, current, 'observation-1', () => 1767225600000);
it('loads a full multi-batch cohort with exact identity coverage, bounded concurrency and second membership pass', async () => {
  const t = transport(501), result = await load(t.fn);
  expect(result.history.operations).toHaveLength(501); expect(result.decisions).toHaveLength(501); expect(t.peak()).toBeLessThanOrEqual(4);
  expect(t.fn.mock.calls.filter(([r]) => r.method === 'POST')).toHaveLength(6);
  expect(t.fn.mock.calls.filter(([r]) => r.method === 'GET')).toHaveLength(14);
  expect(result.consistency).toBe('observed_only_non_atomic');
  for (const [req] of t.fn.mock.calls) { expect(req.url).not.toContain(owner); expect(req.cache).toBe('no-store'); }
});
it('validates empty recorded periods twice without making an invalid empty batch', async () => {
  const t = transport(0), result = await load(t.fn); expect(result.history.operations).toEqual([]); expect(result.decisions).toEqual([]);
  expect(t.fn).toHaveBeenCalledTimes(4);
});
for (const [label, alter] of [
  ['omission', (r: Record<string, unknown>) => ({ ...r, operations: [] })],
  ['duplicate', (r: Record<string, unknown>) => ({ ...r, operations: [(r.operations as unknown[])[0], (r.operations as unknown[])[0]] })],
  ['foreign identity', (r: Record<string, unknown>) => ({ ...r, operations: [{ ...(r.operations as object[])[0], operationId: 'f'.repeat(24) }] })],
  ['wrong period', (r: Record<string, unknown>) => ({ ...r, window: { startInclusive: 0, endExclusive: 1 } })],
  ['wrong coverage', (r: Record<string, unknown>) => ({ ...r, coverage: 'all_history' })],
  ['private metadata', (r: Record<string, unknown>) => ({ ...r, sourceFingerprint: 'private' })],
] as const) it('rejects batch '+label+' without partial output', async () => {
  const t = transport(label === 'duplicate' ? 2 : 1, r => r.version ? alter(r) : r);
  await expect(load(t.fn)).rejects.toThrow('COHERENT_HISTORY_UNAVAILABLE');
});
it('rejects a missing batch/network failure', async () => {
  const t = transport(101); const base = t.fn.getMockImplementation()!;
  t.fn.mockImplementation(async req => { if (req.method === 'POST' && (req.body as { operations: unknown[] }).operations.length === 1) throw Error('Unavailable'); return base(req); });
  await expect(load(t.fn)).rejects.toThrow();
});
for (const kind of ['added', 'deleted', 'modified', 'foreign'] as const) it('rejects observable '+kind+' source/membership changes', async () => {
  const t = transport(1, (r, call) => {
    if (call <= 3 || !r.expenses) return r;
    if (kind === 'added') return { ...r, total: 2, expenses: [record(1), record(2)] };
    if (kind === 'deleted') return { ...r, total: 0, expenses: [] };
    return { ...r, expenses: [{ ...record(1), ...(kind === 'modified' ? { amount: 99 } : { owner: 'b'.repeat(24) }) }] };
  });
  await expect(load(t.fn)).rejects.toThrow('COHERENT_HISTORY_UNAVAILABLE');
});
it('rejects source edits observed only in the coherent batch', async () => {
  const t = transport(1, r => r.version ? { ...r, operations: [{ dataset: 'expenses', operationId: record(1)._id,
    facts: wire({ ...record(1), amount: 99 }), classification: read(record(1)._id) }] } : r);
  await expect(load(t.fn)).rejects.toThrow('COHERENT_HISTORY_UNAVAILABLE');
});
it('rejects oversized/truncated/duplicate membership without annual unbounded requests', async () => {
  for (const change of [{ total: 50001 }, { total: 2 }, { total: 2, expenses: [record(1), record(1)] }]) {
    const t = transport(1, r => r.expenses ? { ...r, ...change } : r);
    await expect(load(t.fn)).rejects.toThrow('COHERENT_HISTORY_UNAVAILABLE');
  }
});
it('checks session/period lifecycle before and after every request and prevents publication', async () => {
  let current = true; const t = transport(1), base = t.fn.getMockImplementation()!;
  t.fn.mockImplementation(async req => { const x = await base(req); current = false; return x; });
  await expect(load(t.fn, () => current)).rejects.toThrow('COHERENT_HISTORY_UNAVAILABLE'); expect(t.fn).toHaveBeenCalledTimes(1);
});
it('keeps missing/null/empty, Unicode and negative zero distinct in safe facts', () => {
  const base = wire();
  expect(Object.is(parseSourceFacts({ ...base, amount: { format: 'binary64-roundtrip-decimal', value: '-0' } }, 'expenses')?.amount, -0)).toBe(true);
  const values = [{ kind: 'missing' }, { kind: 'null' }, { kind: 'value', value: '' }, { kind: 'value', value: 'é' }, { kind: 'value', value: 'e\u0301' }];
  expect(new Set(values.map(comment => JSON.stringify(parseSourceFacts({ ...base, comment }, 'expenses')))).size).toBe(5);
  expect(parseSourceFacts({ ...base, amount: { format: 'binary64-roundtrip-decimal', value: '12.340' } }, 'expenses')).toBeNull();
});
it('rejects precision unsupported by accounting without rounding', async () => {
  const t = transport(1, r => r.version ? { ...r, operations: [{ dataset: 'expenses', operationId: record(1)._id,
    facts: wire({ ...record(1), amount: 0.1 + 0.2 }), classification: read(record(1)._id) }] } : r);
  await expect(load(t.fn)).rejects.toThrow('COHERENT_HISTORY_UNAVAILABLE');
});
