/** @jest-environment node */
import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from 'shared/api/baseApi';
import { historyApi } from '../../api/historyApi';
import { getSessionSnapshot, transitionSession, completeSessionTransition } from 'shared/api/sessionBoundary';
import { expense, expenseResponse, incomeResponse, selectedPeriod } from 'features/FinancialAnalytics/model/tests/fixtures';
const mockTransport = jest.fn<Promise<{ data: unknown } | { error: { status: number; data: unknown } }>, [unknown]>();
jest.mock('shared/api/baseApi', () => {
  const { createApi } = jest.requireActual<typeof import('@reduxjs/toolkit/query/react')>('@reduxjs/toolkit/query/react');
  return { baseApi: createApi({ reducerPath: 'testHistory', baseQuery: (args: unknown) => mockTransport(args),
    tagTypes: ['Expense', 'Income'], endpoints: () => ({}) }) };
});
const makeStore = () => configureStore({ reducer: { [baseApi.reducerPath]: baseApi.reducer },
  middleware: get => get().concat(baseApi.middleware) });
const owner = 'a'.repeat(24), id = '1'.repeat(24);
const args = () => ({ userId: owner, sessionGeneration: getSessionSnapshot().generation, requestScope: 'round1', period: selectedPeriod() });
beforeEach(() => mockTransport.mockReset());
it('uses bounded existing paginated GETs and never sends the caller owner', async () => {
  mockTransport.mockImplementation(async request => ({ data: {
    ...(String((request as { url: string }).url).startsWith('/expenses')
      ? expenseResponse([{ ...expense(id), owner }]) : incomeResponse()), limit: 100,
  } }));
  const store = makeStore(), query = store.dispatch(historyApi.endpoints.getOwnedHistory.initiate(args()));
  try {
    const result = await query; expect(result.isSuccess).toBe(true); expect(result.data?.operations).toHaveLength(1);
    expect(mockTransport).toHaveBeenCalledTimes(2);
    for (const [request] of mockTransport.mock.calls) {
      const url = (request as { url: string }).url;
      expect(url).toContain('limit=100'); expect(url).toContain('page=1'); expect(url).not.toContain('noPagination'); expect(url).not.toContain(owner);
    }
  } finally { query.unsubscribe(); store.dispatch(baseApi.util.resetApiState()); }
});
it('rejects both settled datasets after the authenticated lifecycle changes', async () => {
  let resolve!: (value: { data: unknown }) => void;
  const pending = new Promise<{ data: unknown }>(done => { resolve = done; }); mockTransport.mockReturnValue(pending);
  const store = makeStore(), query = store.dispatch(historyApi.endpoints.getOwnedHistory.initiate(args()));
  const transitioned = transitionSession(() => {}); completeSessionTransition(getSessionSnapshot().generation); await transitioned;
  resolve({ data: {} });
  try { const result = await query; expect(result.isError).toBe(true); expect(result.error).toMatchObject({ error: 'INCOMPLETE_OR_INVALID_HISTORY' }); expect(result.data).toBeUndefined(); }
  finally { query.unsubscribe(); store.dispatch(baseApi.util.resetApiState()); }
});
it('does not turn unavailable classification infrastructure into unreviewed', async () => {
  mockTransport.mockResolvedValue({ error: { status: 503, data: { message: 'fictional private error' } } });
  const store = makeStore(), query = store.dispatch(historyApi.endpoints.readOperationClassification.initiate({
    ...args(), dataset: 'expenses', operationId: id }));
  try { const result = await query; expect(result.isError).toBe(true); expect(result.data).toBeUndefined();
    expect(result.error).toEqual({ status: 'CUSTOM_ERROR', error: 'CLASSIFICATION_UNAVAILABLE' }); }
  finally { query.unsubscribe(); store.dispatch(baseApi.util.resetApiState()); }
});
