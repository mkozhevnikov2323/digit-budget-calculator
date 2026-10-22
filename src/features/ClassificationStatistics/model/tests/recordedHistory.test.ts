import { recordedCategories, recordedHistoryInput, recordedStatistics } from '../recordedHistory';
import { recordedCohort } from './recordedFixtures';
import { STATUSES } from '../statistics';
it('feeds the one existing engine with an accepted complete real-origin cohort and reconciles both datasets/months', () => {
  const c = recordedCohort(), result = recordedStatistics(c); expect(result.ok).toBe(true); if (!result.ok) return;
  expect(result.value.origin).toBe('coherent_adapter'); expect(result.value.expenses.recorded).toEqual({ kopecks: 14808, count: 12 });
  expect(result.value.incomes.recorded).toEqual({ kopecks: 68136, count: 12 });
  expect(result.value.months.reduce((n, m) => n + m.expenses.recorded.kopecks, 0)).toBe(14808);
  expect(result.value.months.every(m => m.recording === 'unverified')).toBe(true);
  expect(recordedCategories(c)).toEqual([{ category: 'Транспорт', kopecks: 14808, count: 12 }]);
});
it('retains every effective status in an exclusive money/count bucket', () => {
  const c = recordedCohort(); c.decisions = c.decisions.map((d, i) => {
    if (i % 2) return d; const status = STATUSES[(i / 2) % 6];
    return { ...d, status, storedState: status === 'unreviewed' || status === 'blocked' ? null : status === 'stale' ? 'approved' : status,
      decisionRevision: status === 'unreviewed' || status === 'blocked' ? null : 1, confirmed: status === 'approved' ? d.confirmed : null };
  });
  const r = recordedStatistics(c); expect(r.ok).toBe(true); if (!r.ok) return;
  for (const s of STATUSES) expect(r.value.expenses.statuses[s]).toEqual({ kopecks: 2468, count: 2 });
  expect(r.value.expenses.layers.everyday.kopecks).toBe(2468); expect(r.value.expenses.coverage.byCount).toBeCloseTo(1 / 6);
});
it('does not infer roles/layers from shared categories and keeps loan/capital movements separate', () => {
  const c = recordedCohort(); c.decisions = c.decisions.map((d, i) => i === 0 ? { ...d, confirmed: { economicRole: 'loan_issuance', layer: null } }
    : i === 2 ? { ...d, confirmed: { economicRole: 'ordinary_expense', layer: 'irregular' } } : d);
  const r = recordedStatistics(c); expect(r.ok).toBe(true); if (!r.ok) return;
  expect(r.value.expenses.roles.loan_issuance?.kopecks).toBe(1234); expect(r.value.expenses.layers.irregular.kopecks).toBe(1234);
  expect(r.value.expenses.layers.everyday.kopecks).toBe(12340); expect(recordedCategories(c)?.[0].kopecks).toBe(14808);
});
it('refuses omitted/reordered/duplicate/foreign classification bindings', () => {
  for (const edit of [
    (c: ReturnType<typeof recordedCohort>) => { c.decisions = c.decisions.slice(1); },
    (c: ReturnType<typeof recordedCohort>) => { c.decisions = [...c.decisions].reverse(); },
    (c: ReturnType<typeof recordedCohort>) => { c.decisions = c.decisions.map((d, i) => i === 2 ? c.decisions[0] : d); },
    (c: ReturnType<typeof recordedCohort>) => { c.decisions = c.decisions.map((d, i) => i === 0 ? { ...d, operationId: 'f'.repeat(24) } : d); },
  ]) { const c = recordedCohort(); edit(c); expect(recordedStatistics(c).ok).toBe(false); }
});
it('empty accepted history is a valid zero recorded report with unknown recording completeness', () => {
  const c = recordedCohort(); c.history = { ...c.history, operations: [] }; c.decisions = [];
  const r = recordedStatistics(c); expect(r.ok).toBe(true); if (!r.ok) return;
  expect(r.value.expenses.recorded.kopecks).toBe(0); expect(r.value.expenses.coverage.byAmount).toBeNull();
  expect(r.value.months.every(m => m.recording === 'unverified')).toBe(true);
});
it('observed reclassification/addition/deletion changes rebuilt totals without mutating original facts', () => {
  const c = recordedCohort(), before = JSON.stringify(c);
  const changed = { ...c, decisions: c.decisions.map((d, i) => i === 0 ? { ...d, status: 'stale' as const, confirmed: null } : d) };
  const r = recordedStatistics(changed); expect(r.ok).toBe(true); if (!r.ok) return;
  expect(r.value.expenses.statuses.stale.kopecks).toBe(1234); expect(r.value.expenses.recorded.kopecks).toBe(14808);
  expect(JSON.stringify(c) === before).toBe(true);
  const deleted = { ...c, history: { ...c.history, operations: c.history.operations.slice(1) }, decisions: c.decisions.slice(1) };
  const d = recordedStatistics(deleted); expect(d.ok).toBe(true); if (d.ok) expect(d.value.expenses.recorded.kopecks).toBe(13574);
});
it('categories preserve exact string identity and recording evidence is never inferred from nonempty data', () => {
  const c = recordedCohort(); c.history = { ...c.history, operations: c.history.operations.map((op, i) => i === 0
    ? { ...op, facts: { ...op.facts, category: ' Транспорт ' } } : op) };
  expect(recordedCategories(c)).toHaveLength(2); expect(recordedHistoryInput(c).monthEvidence.every(x => x.recording === 'unverified')).toBe(true);
});
