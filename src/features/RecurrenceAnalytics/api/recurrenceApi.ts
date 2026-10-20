import { baseApi } from 'shared/api/baseApi';
import { isCurrentSession } from 'shared/api/sessionBoundary';
import type { VerifiedOwner } from 'entities/User/model/verifiedOwner';
import type { RecurrenceReport, RecurrenceWindow } from '../model/types';
import { validateRecurrence } from '../model/validation';
import { validWindow } from '../model/window';

export type RecurrenceQuery = RecurrenceWindow & VerifiedOwner & { readonly requestScope: string };
const obsolete = () => ({ error: { status: 'CUSTOM_ERROR' as const, error: 'SESSION_CHANGED' } });

export const recurrenceApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getRecurrence: builder.query<RecurrenceReport, RecurrenceQuery>({
      // Owner/generation remain cache identity only. The backend authorizes the
      // credential via the unchanged session-aware baseQuery, never query owner.
      async queryFn(args, _api, _options, query) {
        if (!isCurrentSession(args.sessionGeneration)) return obsolete();
        if (!validWindow(args) || !args.userId) {
          return { error: { status: 'CUSTOM_ERROR', error: 'INVALID_RECURRENCE_WINDOW' } };
        }
        const params = new URLSearchParams({ startMonth: args.startMonth, endMonthExclusive: args.endMonthExclusive });
        const result = await query({ url: `/analytics/recurrence?${params}`, method: 'GET' });
        if (!isCurrentSession(args.sessionGeneration)) return obsolete();
        if (result.error) {
          // Retain HTTP status (especially 401/403/413), discard private error
          // bodies and Request/Response metadata. No server text enters the UI.
          const status = result.error.status;
          if (typeof status === 'number') return { error: { status, data: undefined } };
          if (status === 'PARSING_ERROR') {
            const original = result.error.originalStatus;
            return original >= 400 ? { error: { status: original, data: undefined } }
              : { error: { status: 'CUSTOM_ERROR', error: 'INVALID_RECURRENCE_RESPONSE' } };
          }
          return { error: { status: 'CUSTOM_ERROR', error: 'RECURRENCE_REQUEST_FAILED' } };
        }
        const checked = validateRecurrence(result.data, args);
        return checked ? { data: checked } : { error: { status: 'CUSTOM_ERROR', error: 'INVALID_RECURRENCE_RESPONSE' } };
      },
      providesTags: ['Expense', 'Income'],
      keepUnusedDataFor: 0,
    }),
  }),
});

export const { useGetRecurrenceQuery } = recurrenceApi;
