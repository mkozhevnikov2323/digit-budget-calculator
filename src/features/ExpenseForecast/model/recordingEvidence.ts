import type { CoherentHistory } from 'features/HistoricalClassification/model/coherentHistory';
import { monthKeys, monthPeriod } from 'features/FinancialAnalytics/model/period';
import { historyMonthStatus } from 'features/FinancialAnalytics/model/historyCoverage';
import { recordedHistoryInput } from 'features/ClassificationStatistics/model/recordedHistory';
import { buildClassificationStatistics, dataArray } from 'features/ClassificationStatistics/model/statistics';

/** User evidence only: never server proof, never inferred from a nonempty month. */
export const eligibleRecordingMonths = (cohort: CoherentHistory, asOf: number): string[] => {
  const keys = monthKeys(cohort.history.period);
  if (!keys.ok || !Number.isSafeInteger(asOf) || asOf < cohort.observedAt) return [];
  return keys.value.filter(key => {
    const month = monthPeriod(Number(key.slice(0, 4)), Number(key.slice(5, 7)));
    return month.ok && month.value.endExclusive <= asOf
      && historyMonthStatus(key, cohort.history.period, cohort.observedAt) === 'elapsed';
  });
};
export const recordingEvidenceInput = (cohort: CoherentHistory, confirmedInput: unknown, asOf: number):
  { ok: true; value: ReturnType<typeof recordedHistoryInput> } | { ok: false; error: { code: 'invalid_recording_evidence' } } => {
  const confirmed = dataArray(confirmedInput, 120), eligible = eligibleRecordingMonths(cohort, asOf);
  if (!Number.isSafeInteger(asOf) || asOf < cohort.observedAt || !confirmed
    || confirmed.some(key => typeof key !== 'string' || !eligible.includes(key)) || new Set(confirmed).size !== confirmed.length)
    return { ok: false, error: { code: 'invalid_recording_evidence' } };
  const input = recordedHistoryInput(cohort, confirmed as string[]);
  return buildClassificationStatistics(input).ok ? { ok: true, value: input } : { ok: false, error: { code: 'invalid_recording_evidence' } };
};
