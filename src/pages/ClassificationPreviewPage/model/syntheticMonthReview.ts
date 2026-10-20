import { customPeriod, type CalendarPeriod } from 'features/FinancialAnalytics/model/period';
import { createReviewSession } from 'features/FinancialClassification/model/reviewSession';
import { createSyntheticReviewExamples } from 'features/FinancialClassification/ui/syntheticReviewExamples';

/** Reuse validated fictional facts, changing only their controlled calendar
 * dates/revisions. No query, session identity or suggestion is used. */
export const createSyntheticMonthReview = (period: CalendarPeriod) => {
  const examples = createSyntheticReviewExamples();
  const key = period.firstDate.slice(0, 7);
  const date = customPeriod(`${key}-10`, `${key}-10`);
  if (!date.ok) throw new Error('Invalid synthetic calendar fixture');
  return createReviewSession({ userId: examples.ownerScope, sessionGeneration: 0, periodKey: key,
    loadGeneration: `synthetic-${key}` }, { revisionAuthority: 'caller_local',
    expenses: examples.snapshots.expenses.map((operation) => ({ ...operation, revision: `synthetic-${key}`,
      facts: { ...operation.facts, timestamp: date.value.startInclusive } })),
    incomes: examples.snapshots.incomes.map((operation) => ({ ...operation, revision: `synthetic-${key}`,
      facts: { ...operation.facts, timestamp: date.value.startInclusive } })),
  });
};
