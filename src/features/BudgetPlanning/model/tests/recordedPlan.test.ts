import { planFromRecordedHistory } from '../recordedPlan';
import { createBudgetPlan, exportBudgetPlan, importBudgetPlan, comparePlanActual } from '../plan';
import { recordedCohort } from 'features/ClassificationStatistics/model/tests/recordedFixtures';
import { recordingEvidenceInput } from 'features/ExpenseForecast/model/recordingEvidence';
import { syntheticHistoryInput } from 'features/ClassificationStatistics/model/synthetic';
import { FINANCIAL_LAYERS } from 'features/FinancialClassification/model/types';
const asOf = Date.UTC(2026, 0, 2), options = { asOf, adjustmentBasisPoints: 0 };
const makePlan = (year = 2027, reference = { firstDate: '2025-01-01', lastDate: '2025-12-31' }) => {
  const r = createBudgetPlan(year, reference, Object.fromEntries(FINANCIAL_LAYERS.map(l => [l, l === 'major_goals' ? 12000 : 0])), 24000);
  if (!r.ok) throw Error('Fixture'); return r.value;
};
const history = () => { const c = recordedCohort(), keys = Array.from({ length: 12 }, (_, n) => `2025-${String(n + 1).padStart(2, '0')}`);
  const r = recordingEvidenceInput(c, keys, asOf); if (!r.ok) throw Error('Fixture'); return r.value; };
it('fills real estimated layers through existing engines, preserving manual goals/capital/reserve and input immutability', () => {
  const p = makePlan(), h = history(), before = JSON.stringify({ p, h }), r = planFromRecordedHistory(p, h, options, []);
  expect(r.ok).toBe(true); if (!r.ok) return;
  expect(r.value.layers.everyday).toEqual(Array(12).fill(1234)); expect(r.value.layers.major_goals).toEqual(p.layers.major_goals);
  expect(r.value.reserve).toEqual(p.reserve); expect(r.value.basis).toBe('manual'); expect(JSON.stringify({ p, h }) === before).toBe(true);
});
it('preserves manually protected zero targets', () => {
  const p = makePlan(), r = planFromRecordedHistory(p, history(), options, ['everyday']); expect(r.ok).toBe(true);
  if (r.ok) expect(r.value.layers.everyday).toEqual(Array(12).fill(0));
});
it('rejects unverified recording, foreign reference period and synthetic provenance rather than laundering it', () => {
  const p = makePlan(), h = history();
  for (const [plan, input] of [[p, { ...h, monthEvidence: h.monthEvidence.map(m => ({ ...m, recording: 'unverified' })) }],
    [{ ...p, reference: { firstDate: '2024-01-01', lastDate: '2024-12-31' } }, h], [p, syntheticHistoryInput()],
    [{ ...p, basis: 'synthetic_suggestion' }, h]]) expect(planFromRecordedHistory(plan, input, options, []).ok).toBe(false);
});
it('rejects malformed protection and unsafe/invalid plan without a partial replacement', () => {
  for (const mask of [null, {}, ['unknown'], ['everyday', 'everyday']]) expect(planFromRecordedHistory(makePlan(), history(), options, mask).ok).toBe(false);
  expect(planFromRecordedHistory({ ...makePlan(), year: 2020 }, history(), options, []).ok).toBe(false);
  expect(planFromRecordedHistory(makePlan(), history(), { ...options, adjustmentBasisPoints: Infinity }, []).ok).toBe(false);
});
it('keeps the existing versioned JSON format; export is a user target plan, not a completeness proof', () => {
  const r = planFromRecordedHistory(makePlan(), history(), options, []); if (!r.ok) throw Error('Fixture');
  const text = exportBudgetPlan(r.value); expect(text.ok).toBe(true); if (!text.ok) return;
  const imported = importBudgetPlan(text.value); expect(imported.ok).toBe(true); if (imported.ok) expect(imported.value).toEqual(r.value);
  expect(text.value).not.toMatch(/reviewProof|sourceFingerprint|monthEvidence|bearer/);
});
it('compares actual confirmed consumption with the existing engine, leaving reserves out', () => {
  const p = createBudgetPlan(2025, { firstDate: '2024-01-01', lastDate: '2024-12-31' },
    Object.fromEntries(FINANCIAL_LAYERS.map(l => [l, l === 'everyday' ? 14808 : 0])), 24000);
  if (!p.ok) throw Error('Fixture'); const r = comparePlanActual(p.value, history(), asOf); expect(r.ok).toBe(true);
  if (r.ok) { expect(r.value.actualElapsedKopecks).toBe(14808); expect(r.value.varianceKopecks).toBe(0); expect(r.value.remainingScheduledKopecks).toBe(0); }
});
