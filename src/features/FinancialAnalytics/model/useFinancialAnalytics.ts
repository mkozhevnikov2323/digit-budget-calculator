import { useMemo } from 'react';
import { skipToken } from '@reduxjs/toolkit/query';
import { useGetExpensesQuery } from '../../../entities/Expense/api/expenseApi';
import { useGetIncomesQuery } from '../../../entities/Income/api/incomeApi';
import { toAnalyticsQueryParams } from './apiRange';
import { buildAnalytics } from './calculations';
import type { CalendarPeriod } from './period';
import type { FinancialAnalyticsState } from './types';

/** Read-only, existing RTK Query cache/tags only. No page, slice or mutation.
 * currentData belongs to the current args; data may still belong to old args.
 * Hide results while either request is fetching, including background refetch.
 */
export const useFinancialAnalytics = (period: CalendarPeriod | null): FinancialAnalyticsState => {
  const params = useMemo(() => period ? toAnalyticsQueryParams(period) : null, [period]);
  const args = params?.ok ? params.value : skipToken;
  const expenses = useGetExpensesQuery(args);
  const incomes = useGetIncomesQuery(args);
  const isLoading = expenses.isLoading || incomes.isLoading;
  const isFetching = expenses.isFetching || incomes.isFetching;

  return useMemo((): FinancialAnalyticsState => {
    const flags = { isLoading, isFetching };
    if (!params || !params.ok || !period) {
      return { status: 'error', isLoading: false, isFetching: false,
        error: params && !params.ok ? params.error : { code: 'invalid_period' } };
    }
    if (expenses.isError || incomes.isError) {
      return { status: 'error', ...flags, error: { code: 'request_failed',
        dataset: expenses.isError ? 'expenses' : 'incomes' } };
    }
    if (isLoading) return { status: 'loading', ...flags };
    if (isFetching) return { status: 'fetching', ...flags };
    if (expenses.currentData === undefined || incomes.currentData === undefined) {
      return { status: 'error', ...flags, error: { code: 'unavailable_response' } };
    }
    const result = buildAnalytics(expenses.currentData, incomes.currentData, period);
    return result.ok ? { status: 'ready', ...flags, data: result.value }
      : { status: 'error', ...flags, error: result.error };
  }, [params, period, isLoading, isFetching, expenses.isError, incomes.isError,
    expenses.currentData, incomes.currentData]);
};
