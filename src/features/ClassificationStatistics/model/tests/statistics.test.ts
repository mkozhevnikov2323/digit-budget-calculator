/** @jest-environment node */
import { buildClassificationStatistics, STATUSES } from '../statistics';
import { syntheticHistoryInput } from '../synthetic';
const value = (input: unknown = syntheticHistoryInput()) => {
  const r = buildClassificationStatistics(input); if (!r.ok) throw Error(r.error.code); return r.value;
};
const change = (input: ReturnType<typeof syntheticHistoryInput>, field: 'operations' | 'decisions', index: number, extra: object) =>
  ({ ...input, [field]: input[field].map((x, i) => i === index ? { ...x, ...extra } : x) });

describe('exclusive classified-history accounting', () => {
  it('matches independent totals and separates roles/layers from cash flow', () => {
    const r = value();
    expect(r.expenses.recorded).toEqual({ kopecks: 1737800, count: 32 });
    expect(r.incomes.recorded).toEqual({ kopecks: 3600000, count: 12 });
    expect(r.expenses.roles.loan_issuance).toEqual({ kopecks: 80000, count: 1 });
    expect(Object.values(r.expenses.layers).reduce((n, b) => n + b.kopecks, 0)).toBe(1597800);
    expect(r.expenses.statuses.unreviewed).toEqual({ kopecks: 60000, count: 12 });
    expect(r.expenses.coverage.byCount).toBe(20 / 32);
    expect(r.expenses.coverage.byAmount).toBe(1677800 / 1737800);
    for (const dataset of ['expenses', 'incomes'] as const) {
      expect(STATUSES.reduce((n, s) => n + r[dataset].statuses[s].kopecks, 0)).toBe(r[dataset].recorded.kopecks);
      expect(STATUSES.reduce((n, s) => n + r[dataset].statuses[s].count, 0)).toBe(r[dataset].recorded.count);
      expect(r.months.reduce((n, m) => n + m[dataset].recorded.kopecks, 0)).toBe(r[dataset].recorded.kopecks);
    }
  });
  it.each(STATUSES)('keeps %s mutually exclusive and never counts uncertain assignments', status => {
    const input = syntheticHistoryInput(2025, false);
    const first = input.decisions[0] as { read: Record<string, unknown> };
    const absent = status === 'unreviewed' || status === 'blocked';
    const read = { ...first.read, status, storedState: absent ? null : status === 'stale' ? 'approved' : status,
      decisionRevision: absent ? null : 1, confirmed: status === 'approved' ? first.read.confirmed : null };
    const r = value(change(input, 'decisions', 0, { read }));
    expect(r.expenses.statuses[status].count).toBe(status === 'approved' ? 20 : 1);
    expect(r.expenses.layers.everyday.count).toBe(status === 'approved' ? 12 : 11);
  });
  it.each(['scope', 'source', 'missing', 'duplicate', 'amount', 'extra', 'taxonomy', 'overflow'])('fails closed for %s', kind => {
    const input = syntheticHistoryInput(); let modified: unknown = input;
    if (kind === 'scope') modified = change(input, 'operations', 0, { owner: 'b'.repeat(24) });
    if (kind === 'source') modified = change(input, 'decisions', 0, { sourceObservationId: 'another-observation' });
    if (kind === 'missing') modified = { ...input, decisions: input.decisions.slice(1) };
    if (kind === 'duplicate') modified = { ...input, operations: [...input.operations, input.operations[0]], decisions: [...input.decisions, input.decisions[0]] };
    if (kind === 'amount') modified = change(input, 'operations', 0, { kopecks: 1.2 });
    if (kind === 'extra') modified = { ...input, clientConfirmed: true };
    if (kind === 'taxonomy') modified = { ...input, taxonomyVersion: 'financial-layers-v1-provisional' };
    if (kind === 'overflow') modified = change(input, 'operations', 0, { kopecks: Number.MAX_SAFE_INTEGER });
    expect(buildClassificationStatistics(modified).ok).toBe(false);
    expect(buildClassificationStatistics(modified)).not.toHaveProperty('value');
  });
  it('rejects invalid hooks, calendar inputs, partial evidence and sparse arrays safely', () => {
    const input = syntheticHistoryInput(), hook = jest.fn(() => { throw Error('fictional'); });
    const revoked = Proxy.revocable({}, {}); revoked.revoke();
    const cases = [Object.create(input), { ...input, monthEvidence: [] }, { ...input, operations: Array(2) },
      Object.defineProperty({ ...input }, 'operations', { get: hook, enumerable: true }),
      { ...input, period: { ...input.period, endExclusive: NaN } }, revoked.proxy];
    for (const c of cases) expect(buildClassificationStatistics(c).ok).toBe(false);
    expect(hook).not.toHaveBeenCalled();
  });
  it('owns outputs and represents empty recorded months without asserting continuity', () => {
    const input = syntheticHistoryInput(), before = JSON.stringify(input); value(input); expect(JSON.stringify(input)).toBe(before);
    const r = value({ ...input, operations: [], decisions: [], monthEvidence: input.monthEvidence.map(m => ({ ...m, recording: 'unverified' })) });
    expect(r.expenses.coverage).toEqual({ byAmount: null, byCount: null });
    expect(r.months).toHaveLength(12); expect(r.months.every(m => m.recording === 'unverified')).toBe(true);
  });
});
