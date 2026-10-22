import { baseApi } from 'shared/api/baseApi';
import { isCurrentSession } from 'shared/api/sessionBoundary';
import type { CalendarPeriod } from 'features/FinancialAnalytics/model/period';
import { toAnalyticsQueryParams } from 'features/FinancialAnalytics/model/apiRange';
import { validateOwnedHistory, type OwnedHistory } from '../model/history';
import { validateClassificationRead, type ClassificationRead } from '../model/contract';

type Scope = { userId: string; sessionGeneration: number; requestScope: string };
export type HistoryQuery = Scope & { period: CalendarPeriod };
export type DecisionQuery = Scope & { dataset: 'expenses' | 'incomes'; operationId: string };
const error = (code: string) => ({ error: { status: 'CUSTOM_ERROR' as const, error: code } });

export const historyApi = baseApi.injectEndpoints({ endpoints: builder => ({
  getOwnedHistory: builder.query<OwnedHistory, HistoryQuery>({
    async queryFn(args, _api, _options, query) {
      const params = toAnalyticsQueryParams(args.period);
      if (!params.ok || !isCurrentSession(args.sessionGeneration)) return error('INVALID_HISTORY_CONTEXT');
      const suffix = new URLSearchParams({ ...params.value, noPagination: 'true' }).toString();
      const [e, i] = await Promise.all([query(`/expenses?${suffix}`), query(`/incomes?${suffix}`)]);
      if (!isCurrentSession(args.sessionGeneration)) return error('SESSION_CHANGED');
      if (e.error || i.error) return error('HISTORY_UNAVAILABLE');
      const checked = validateOwnedHistory(e.data, i.data, args.period, args.userId);
      return checked.ok ? { data: checked.value } : error('INCOMPLETE_OR_INVALID_HISTORY');
    }, providesTags: ['Expense', 'Income'], keepUnusedDataFor: 0,
  }),
  readOperationClassification: builder.query<ClassificationRead, DecisionQuery>({
    async queryFn(args, _api, _options, query) {
      if (!isCurrentSession(args.sessionGeneration)) return error('SESSION_CHANGED');
      // No owner or browser authority is sent to the server; unchanged JWT guard authorizes GET.
      const result = await query({ url: `/classifications/${args.dataset}/${encodeURIComponent(args.operationId)}`, method: 'GET', cache: 'no-store' });
      if (!isCurrentSession(args.sessionGeneration)) return error('SESSION_CHANGED');
      if (result.error) return error('CLASSIFICATION_UNAVAILABLE');
      const checked = validateClassificationRead(result.data, args.dataset, args.operationId);
      return checked ? { data: checked } : error('INVALID_CLASSIFICATION_RESPONSE');
    }, providesTags: ['Expense', 'Income'], keepUnusedDataFor: 0,
  }),
}) });
export const { useGetOwnedHistoryQuery, useReadOperationClassificationQuery } = historyApi;
