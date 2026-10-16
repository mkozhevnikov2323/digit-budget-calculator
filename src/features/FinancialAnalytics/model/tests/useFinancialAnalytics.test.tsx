import type { ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { baseApi } from 'shared/api/baseApi';
import { useFinancialAnalytics } from '../useFinancialAnalytics';
import type { FinancialAnalyticsState } from '../types';
import type { CalendarPeriod } from '../period';
import { expense, income, expenseResponse, incomeResponse, selectedPeriod } from './fixtures';

const mockFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

// Keep the actual endpoint definitions, React hooks, reducer, middleware and
// caching. Replace only the base transport so no app URL/token or real network
// is involved. Every request reaches mockFetch, including unexpected requests.
jest.mock('shared/api/baseApi', () => {
  const { createApi, fetchBaseQuery } = jest.requireActual<typeof import('@reduxjs/toolkit/query/react')>('@reduxjs/toolkit/query/react');
  const query = fetchBaseQuery({
    baseUrl: 'https://analytics.invalid',
    fetchFn: (...args: Parameters<typeof fetch>) => mockFetch(...args),
  });
  return {
    baseApi: createApi({
      reducerPath: 'analyticsTestApi',
      // Node's Request rejects JSDOM AbortSignal objects. No real transport is
      // used here; omit that signal only in this mock, preserving fetchBaseQuery.
      baseQuery: (args: string | import('@reduxjs/toolkit/query').FetchArgs, api, options) =>
        query({ ...(typeof args === 'string' ? { url: args } : args), signal: undefined }, api, options),
      tagTypes: ['Expense', 'Income', 'Balance'],
      endpoints: () => ({}),
    }),
  };
});

const makeStore = () => configureStore({
  reducer: { [baseApi.reducerPath]: baseApi.reducer },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
});
const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const requestUrl = (input: RequestInfo | URL, init?: RequestInit) => new URL(new Request(input, init).url);
const deferred = () => {
  let resolve!: (value: Response) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<Response>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};

describe('useFinancialAnalytics with existing RTK Query endpoints', () => {
  const stores: ReturnType<typeof makeStore>[] = [];
  let consoleError: jest.SpyInstance;
  const wrapperFor = (store: ReturnType<typeof makeStore>) => ({ children }: { children: ReactNode }) =>
    <Provider store={store}>{children}</Provider>;
  const setup = (period: CalendarPeriod | null = selectedPeriod()) => {
    const store = makeStore();
    stores.push(store);
    const wrapper = wrapperFor(store);
    return { store, wrapper, ...renderHook(({ period }) => useFinancialAnalytics(period), {
      initialProps: { period }, wrapper,
    }) };
  };

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error');
    mockFetch.mockReset();
    mockFetch.mockImplementation(async (input, init) => requestUrl(input, init).pathname === '/expenses'
      ? response(expenseResponse([expense('e', 0.3)])) : response(incomeResponse([income('i', 1)])));
  });
  afterEach(() => {
    // Unmount before reset: otherwise subscribed hooks refetch during teardown.
    cleanup();
    act(() => stores.splice(0).forEach((store) => store.dispatch(baseApi.util.resetApiState())));
    try {
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('uses two existing GETs with identical complete-period params, without credentials or mutations', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ isLoading: false, isFetching: false,
      data: { expenseKopecks: 30, incomeKopecks: 100, differenceKopecks: 70 } });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const requests = mockFetch.mock.calls.map(([input, init]) => new Request(input, init));
    expect(requests.map((request) => new URL(request.url).pathname).sort()).toEqual(['/expenses', '/incomes']);
    for (const request of requests) {
      expect(request.method).toBe('GET');
      expect(request.headers.has('Authorization')).toBe(false);
      expect(request.body).toBeNull();
      const params = new URL(request.url).searchParams;
      expect(Object.fromEntries(params)).toEqual({
        startDate: '2024-02-01T00:00:00.000Z', endDate: '2024-02-29T23:59:59.999Z', noPagination: 'true',
      });
    }
  });

  it('reuses the existing cache across rerenders and multiple consumers of the same period', async () => {
    const hook = setup();
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));
    hook.rerender({ period: { ...selectedPeriod() } });
    const second = renderHook(() => useFinancialAnalytics(selectedPeriod()), { wrapper: hook.wrapper });
    await waitFor(() => expect(second.result.current.status).toBe('ready'));
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('blocks complete results until both datasets finish loading', async () => {
    const pending = deferred();
    mockFetch.mockImplementation(async (input, init) => requestUrl(input, init).pathname === '/expenses'
      ? response(expenseResponse([expense()])) : pending.promise);
    const { result } = setup();
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(result.current.status).toBe('loading');
    expect(result.current.isLoading).toBe(true);
    expect(result.current).not.toHaveProperty('data');
    await act(async () => pending.resolve(response(incomeResponse())));
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('exposes endpoint failure while the other endpoint is still pending, without partial data', async () => {
    const pending = deferred();
    mockFetch.mockImplementation((input, init) => requestUrl(input, init).pathname === '/expenses'
      ? Promise.reject(new Error('Synthetic network failure')) : pending.promise);
    const { result } = setup();
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current).toMatchObject({ error: { code: 'request_failed', dataset: 'expenses' } });
    expect(result.current).not.toHaveProperty('data');
    await act(async () => pending.resolve(response(incomeResponse())));
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.status).toBe('error');
  });

  it('does not mix late responses from an old period with the new period', async () => {
    const oldIncome = deferred();
    const newExpense = deferred();
    const newIncome = deferred();
    mockFetch.mockImplementation(async (input, init) => {
      const url = requestUrl(input, init);
      const oldPeriod = url.searchParams.get('startDate') === '2024-02-01T00:00:00.000Z';
      if (oldPeriod) return url.pathname === '/expenses' ? response(expenseResponse([expense('old-e', 999)])) : oldIncome.promise;
      return url.pathname === '/expenses' ? newExpense.promise : newIncome.promise;
    });
    const observed: FinancialAnalyticsState[] = [];
    const store = makeStore();
    stores.push(store);
    const hook = renderHook(({ period }) => {
      const state = useFinancialAnalytics(period);
      observed.push(state);
      return state;
    }, { initialProps: { period: selectedPeriod() }, wrapper: wrapperFor(store) });
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    hook.rerender({ period: selectedPeriod('2024-03-01', '2024-03-31') });
    const switchedAt = observed.length;
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(4));
    await act(async () => newExpense.resolve(response(expenseResponse([expense('new-e', 2, 'Еда', '2024-03-10T12:00:00Z')]))));
    await act(async () => oldIncome.resolve(response(incomeResponse([income('old-i', 999)]))));
    expect(hook.result.current.status).not.toBe('ready');
    expect(hook.result.current).not.toHaveProperty('data');
    await act(async () => newIncome.resolve(response(incomeResponse([income('new-i', 5, 'Salary', '2024-03-20T12:00:00Z')]))));
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));
    expect(hook.result.current).toMatchObject({ data: { expenseKopecks: 200, incomeKopecks: 500,
      differenceKopecks: 300, period: { firstDate: '2024-03-01' } } });
    for (const state of observed.slice(switchedAt)) {
      if (state.status === 'ready') expect(state.data.period.firstDate).toBe('2024-03-01');
      else expect(state).not.toHaveProperty('data');
    }
  });

  it('hides cached totals during tag-driven refetch and publishes only the settled result', async () => {
    const { result, store } = setup();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const pending = deferred();
    mockFetch.mockImplementation(() => pending.promise);
    act(() => { store.dispatch(baseApi.util.invalidateTags(['Expense'])); });
    await waitFor(() => expect(result.current.status).toBe('fetching'));
    expect(result.current).toMatchObject({ isLoading: false, isFetching: true });
    expect(result.current).not.toHaveProperty('data');
    await act(async () => pending.resolve(response(expenseResponse([expense('updated', 0.5)]))));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ data: { expenseKopecks: 50 } });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it.each([
    { name: 'incomplete payload', body: expenseResponse([], { total: 5 }), code: 'incomplete_response' },
    { name: 'unsupported precision', body: expenseResponse([expense('e', 1.005)]), code: 'invalid_amount' },
  ])('exposes $name as a failure, not valid zero analytics', async ({ body, code }) => {
    mockFetch.mockImplementation(async (input, init) => response(requestUrl(input, init).pathname === '/expenses' ? body : incomeResponse()));
    const { result } = setup();
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current).toMatchObject({ error: { code } });
    expect(result.current).not.toHaveProperty('data');
  });

  it('reports successfully loaded empty data as ready with valid zeros', async () => {
    mockFetch.mockImplementation(async (input, init) => response(requestUrl(input, init).pathname === '/expenses'
      ? expenseResponse() : incomeResponse()));
    const { result } = setup();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ data: { incomeKopecks: 0, expenseKopecks: 0, differenceKopecks: 0 } });
  });

  it.each([null, { ...selectedPeriod(), endExclusive: NaN }])('skips both requests for invalid period %p', (period) => {
    const { result } = setup(period);
    expect(result.current).toMatchObject({ status: 'error', error: { code: 'invalid_period' } });
    expect(result.current).not.toHaveProperty('data');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
