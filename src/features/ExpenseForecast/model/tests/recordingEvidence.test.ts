import { eligibleRecordingMonths, recordingEvidenceInput } from '../recordingEvidence';
import { forecastExpenses, compareForecastYears } from '../forecast';
import { recordedCohort } from 'features/ClassificationStatistics/model/tests/recordedFixtures';
import { monthKeys } from 'features/FinancialAnalytics/model/period';
const asOf = Date.UTC(2026, 0, 2);
const keys = (c = recordedCohort()) => { const k = monthKeys(c.history.period); if (!k.ok) throw Error('Fixture'); return k.value; };
const evidence = (c = recordedCohort(), months = keys(c)) => {
  const r = recordingEvidenceInput(c, months, asOf); if (!r.ok) throw Error('Fixture'); return r.value;
};
it('permits the existing forecast only after all twelve elapsed months are explicitly attested', () => {
  const c = recordedCohort(), unverified = recordingEvidenceInput(c, [], asOf); expect(unverified.ok).toBe(true);
  if (unverified.ok) expect(forecastExpenses(unverified.value, { asOf, adjustmentBasisPoints: 0 }).ok).toBe(false);
  const r = forecastExpenses(evidence(c), { asOf, adjustmentBasisPoints: 0 }); expect(r.ok).toBe(true); if (!r.ok) return;
  expect(r.value.origin).toBe('coherent_adapter'); expect(r.value.layers.everyday.monthlyEstimateKopecks).toBe(1234);
  expect(r.value.layers.everyday.projectedAnnualKopecks).toBe(14808);
});
it('never infers empty/nonempty month completeness or actual zero spending', () => {
  const c = recordedCohort(); c.history = { ...c.history, operations: [] }; c.decisions = [];
  const r = recordingEvidenceInput(c, [], asOf); expect(r.ok).toBe(true); if (!r.ok) return;
  expect(r.value.monthEvidence.every(m => m.recording === 'unverified')).toBe(true);
  expect(forecastExpenses(evidence(c), { asOf, adjustmentBasisPoints: 0 })).toMatchObject({ ok: false, error: { code: 'no_confirmed_spending' } });
});
it('rejects duplicates, unknown months, getters and malformed evidence without coercion', () => {
  const c = recordedCohort(), hostile = [keys(c)[0]]; Object.defineProperty(hostile, '0', { get() { throw Error('Forbidden'); }, enumerable: true });
  for (const x of [null, {}, [keys(c)[0], keys(c)[0]], ['2024-01'], [123], hostile]) expect(recordingEvidenceInput(c, x, asOf).ok).toBe(false);
});
it('current/future/partial selected months cannot be attested as completed history', () => {
  const c = recordedCohort(2026), now = Date.UTC(2026, 9, 15); c.observedAt = now;
  expect(eligibleRecordingMonths(c, now)).toHaveLength(9); expect(recordingEvidenceInput(c, keys(c), now).ok).toBe(false);
  const r = recordingEvidenceInput(c, eligibleRecordingMonths(c, now), now); expect(r.ok).toBe(true);
  if (r.ok) expect(forecastExpenses(r.value, { asOf: now, adjustmentBasisPoints: 0 })).toMatchObject({ ok: false, error: { code: 'incomplete_months' } });
});
it('partial classification remains visible and unknown amounts are not extrapolated', () => {
  const c = recordedCohort(); c.decisions = c.decisions.map((d, i) => i === 0 ? { ...d, status: 'unreviewed', storedState: null, decisionRevision: null, confirmed: null } : d);
  const r = forecastExpenses(evidence(c), { asOf, adjustmentBasisPoints: 0 }); expect(r.ok).toBe(true); if (!r.ok) return;
  expect(r.value.classificationCoverage).toBe('partial'); expect(r.value.uncoveredKopecks).toBe(1234); expect(r.value.uncoveredCount).toBe(1);
});
it('irregular/emergency spikes are historical allocations and goals remain manual', () => {
  const c = recordedCohort(); c.decisions = c.decisions.map((d, i) => i === 0 || i === 2 ? { ...d,
    confirmed: { economicRole: 'ordinary_expense', layer: i === 0 ? 'irregular' : 'emergency' } } : d);
  const r = forecastExpenses(evidence(c), { asOf, adjustmentBasisPoints: 0 }); expect(r.ok).toBe(true); if (!r.ok) return;
  expect(r.value.layers.irregular.method).toBe('historical_allocation'); expect(r.value.layers.emergency.method).toBe('historical_allocation');
  expect(r.value.layers.major_goals.monthlyEstimateKopecks).toBeNull(); expect(r.value.layers.long_term_capital.monthlyEstimateKopecks).toBeNull();
});
it('user scenarios affect derived estimates without mutating recorded source facts', () => {
  const c = recordedCohort(), before = JSON.stringify(c), r = forecastExpenses(evidence(c), { asOf, adjustmentBasisPoints: 1000 });
  expect(r.ok).toBe(true); if (r.ok) expect(r.value.layers.everyday.monthlyEstimateKopecks).toBe(1357);
  expect(JSON.stringify(c) === before).toBe(true);
});
it('requires explicit independent evidence for comparable adjacent years', () => {
  const current = evidence(), previous = recordedCohort(2024);
  const unverified = recordingEvidenceInput(previous, [], asOf); if (!unverified.ok) throw Error('Fixture');
  expect(compareForecastYears(current, unverified.value, { asOf, adjustmentBasisPoints: 0 }).ok).toBe(false);
  const r = compareForecastYears(current, evidence(previous), { asOf, adjustmentBasisPoints: 0 }); expect(r.ok).toBe(true);
  if (r.ok) expect(r.value.everyday).toBe(0);
});
it('fails on unsafe money/invalid observation time without creating a rounded estimate', () => {
  const c = recordedCohort(); c.history = { ...c.history, operations: c.history.operations.map((op, i) => i === 0 ? { ...op, kopecks: Number.MAX_SAFE_INTEGER + 1 } : op) };
  expect(recordingEvidenceInput(c, keys(c), asOf).ok).toBe(false); expect(recordingEvidenceInput(recordedCohort(), [], NaN).ok).toBe(false);
});
