import type { MoneyError } from './money';
import type { CalendarPeriod, PeriodError } from './period';

export type AnalyticsDataset = 'expenses' | 'incomes';
export type AnalyticsErrorCode =
  | 'invalid_period' | 'invalid_response' | 'invalid_metadata' | 'incomplete_response'
  | 'invalid_record' | 'invalid_id' | 'duplicate_id' | 'invalid_date' | 'outside_period'
  | 'invalid_amount' | 'invalid_category' | 'invalid_source' | 'overflow'
  | 'request_failed' | 'unavailable_response';

/** Diagnostics identify the failing field/dataset without exposing source records. */
export type AnalyticsError = {
  readonly code: AnalyticsErrorCode;
  readonly dataset?: AnalyticsDataset;
  readonly index?: number;
  readonly cause?: MoneyError | PeriodError;
};

export type AnalyticsResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AnalyticsError };

export type ValidatedTransaction = {
  readonly id: string;
  readonly timestamp: number;
  readonly kopecks: number;
};
export type ValidatedExpense = ValidatedTransaction & {
  readonly category: string;
  readonly isLoanIssuance: boolean;
};
export type ValidatedIncome = ValidatedTransaction & { readonly source: string };
export type ValidatedDataset<T> = { readonly records: readonly T[]; readonly totalKopecks: number };

export type CategoryTotal = {
  readonly category: string;
  readonly kopecks: number;
  readonly count: number;
  /** Nonmonetary ratio in percent (0–100); display rounding belongs to the UI. */
  readonly share: number;
};
export type FinancialAnalytics = {
  readonly period: CalendarPeriod;
  readonly incomeKopecks: number;
  readonly expenseKopecks: number;
  readonly differenceKopecks: number;
  readonly incomeCount: number;
  readonly expenseCount: number;
  readonly categories: readonly CategoryTotal[];
  readonly dynamics: readonly { readonly key: string; readonly kopecks: number }[];
  /** Exact label matches only; already included in the primary recorded totals. */
  readonly loans: { readonly issuedKopecks: number; readonly returnedKopecks: number };
};

export type FinancialAnalyticsState = {
  readonly isLoading: boolean;
  readonly isFetching: boolean;
} & (
  | { readonly status: 'loading' | 'fetching' }
  | { readonly status: 'error'; readonly error: AnalyticsError }
  | { readonly status: 'ready'; readonly data: FinancialAnalytics }
);
