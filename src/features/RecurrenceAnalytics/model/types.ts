export type RecurrenceWindow = Readonly<{ startMonth: string; endMonthExclusive: string }>;
export type RecurrenceGroup =
  | Readonly<{ dataset: 'expenses' | 'incomes'; level: 'category_or_source';
    identity: { readonly provenance: 'label_only'; readonly value: string } }>
  | Readonly<{ dataset: 'expenses'; level: 'similar_expense';
    identity: { readonly provenance: 'label_only'; readonly value: string }; title: string; recipient: string }>;
export type RecurrenceObservation = Readonly<{
  group: RecurrenceGroup;
  operationCount: number;
  activeMonthCount: number;
  activeMonths: readonly string[];
  intervalsInMonths: readonly number[];
  longestConsecutiveMonths: number;
}>;
export type RecurrenceReport = Readonly<{
  version: 'observations-v0';
  window: RecurrenceWindow;
  coverage: Readonly<{ source: 'stored_records_only'; historicalContinuity: 'unverified';
    atomicSnapshot: false; maxRecordsPerDataset: 1000 }>;
  observations: readonly RecurrenceObservation[];
}>;
