import { configureStore } from '@reduxjs/toolkit';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider, useSelector } from 'react-redux';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router';
import { Profiler, useEffect } from 'react';
import { baseApi } from '../baseApi';
import { completeSessionTransition, getSessionSnapshot, isCurrentSession } from '../sessionBoundary';
import { withSessionBoundary } from '../sessionBaseQuery';
import rootReducer from '../../../app/providers/store/rootReducer';
import { Protected } from '../../../app/providers/router/ProtectedRoute';
import { InitAuth } from '../../../app/providers/init/InitAuth';
import { UserProvider } from '../../../entities/User/ui/UserProvider';
import { expenseApi, useGetExpensesQuery } from '../../../entities/Expense/api/expenseApi';
import { userApi } from '../../../entities/User/api/userApi';
import { authApi } from '../../../features/Authorization/api/authApi';
import { completeLogin, logout } from '../../../features/Authorization/model/authThunks';
import { expense, expenseResponse } from '../../../features/FinancialAnalytics/model/tests/fixtures';
import type { RootState } from '../../../app/providers/store/store';

const mockFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
const mockPrivateUnmount = jest.fn();
// Re-export the real reducers without loading UI barrels (the npm `entities`
// package collides with the application's absolute aliases under Jest).
jest.mock('features/Authorization', () => ({
  authorizationReducer: jest.requireActual('../../../features/Authorization/model/authorizationSlice').reducer,
  setAuthenticated: jest.requireActual('../../../features/Authorization/model/authorizationSlice').setAuthenticated,
}));
jest.mock('entities/User', () => ({ userReducer: jest.requireActual('../../../entities/User/model/userSlice').reducer }), { virtual: true });
jest.mock('entities/Income', () => ({ incomeReducer: jest.requireActual('../../../entities/Income/model/incomeSlice').reducer }), { virtual: true });
jest.mock('entities/Expense', () => ({ expenseReducer: jest.requireActual('../../../entities/Expense/model/expenseSlice').reducer }), { virtual: true });
jest.mock('entities/IncomeSource', () => ({ incomeSourceReducer: jest.requireActual('../../../entities/IncomeSource/model/sourceSlice').incomeSourceReducer }), { virtual: true });
jest.mock('widgets/Modals/AddIncomeModal', () => ({ addIncomeModalReducer: jest.requireActual('../../../widgets/Modals/AddIncomeModal/model/addIncomeModalSlice').addIncomeModalReducer }));
jest.mock('widgets/Modals/AddExpenseModal', () => ({ addExpenseModalReducer: jest.requireActual('../../../widgets/Modals/AddExpenseModal/model/addExpenseModalSlice').addExpenseModalReducer }));
jest.mock('widgets/Modals/EditIncomeModal', () => ({ editIncomeModalReducer: jest.requireActual('../../../widgets/Modals/EditIncomeModal/model/editIncomeModalSlice').editIncomeModalReducer }));
jest.mock('widgets/Modals/EditExpenseModal', () => ({ editExpenseModalReducer: jest.requireActual('../../../widgets/Modals/EditExpenseModal/model/editExpenseModalSlice').editExpenseModalReducer }));
jest.mock('shared/api/baseApi', () => {
  const { createApi, fetchBaseQuery } = jest.requireActual<typeof import('@reduxjs/toolkit/query/react')>('@reduxjs/toolkit/query/react');
  const { withSessionBoundary } = jest.requireActual<typeof import('../sessionBaseQuery')>('../sessionBaseQuery');
  const http = fetchBaseQuery({ baseUrl: 'https://session.invalid', fetchFn: (...args: Parameters<typeof fetch>) => mockFetch(...args) });
  return { baseApi: createApi({ reducerPath: 'api', endpoints: () => ({}),
    // Transport-only JSDOM adaptation, as in existing analytics tests. Keep the
    // real production generation/header/result guard outside the HTTP adapter.
    baseQuery: withSessionBoundary((args, api, options) => http({ ...(typeof args === 'string' ? { url: args } : args), signal: undefined }, api, options)),
    tagTypes: ['Income', 'User', 'Source', 'Expense', 'Balance', 'ExpenseCategory', 'Recipients', 'ExpenseTitles'],
  }) };
});

const tokenA = 'synthetic-token-a';
const tokenB = 'synthetic-token-b';
const args = { startDate: '2024-02-01T00:00:00.000Z', endDate: '2024-02-29T23:59:59.999Z', noPagination: true };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const payload = (owner: string) => expenseResponse([expense(`synthetic-owner-${owner}`, 0.01)]);
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
const pathOf = (input: RequestInfo | URL, init?: RequestInit) => new URL(new Request(input, init).url).pathname;
const credentialOf = (input: RequestInfo | URL, init?: RequestInit) => new Request(input, init).headers.get('Authorization');
const makeStore = () => configureStore({ reducer: rootReducer, middleware: (defaults) => defaults().concat(baseApi.middleware) });
const Location = () => <div data-testid="location">{useLocation().pathname}</div>;
const PrivateRows = () => {
  useEffect(() => () => { mockPrivateUnmount(); }, []);
  const query = useGetExpensesQuery(args);
  const user = useSelector((state: RootState) => state.user.user);
  // Intentionally use data, as existing consumers may retain hook-local data.
  // The keyed subtree must discard that hook state across credential lifecycles.
  return <><Location /><div data-testid="private">{query.data?.expenses[0]?._id ?? 'none'}</div>
    <div data-testid="profile">{user?.email ?? 'none'}</div>
    <input aria-label="Synthetic financial draft" defaultValue="" /></>;
};
const appTree = (store: ReturnType<typeof makeStore>, path: string, frames: string[]) => (
  <Provider store={store}><MemoryRouter initialEntries={[path]}>
    <Profiler id="session" onRender={() => frames.push(document.body.textContent ?? '')}>
      <UserProvider><InitAuth /><Routes><Route path="/" element={<Location />} />
        <Route path="/expenses" element={<Protected><PrivateRows /></Protected>} />
        <Route path="/income" element={<Protected><PrivateRows /></Protected>} />
      </Routes></UserProvider>
    </Profiler>
  </MemoryRouter></Provider>
);

describe('real RTK Query session boundary with synthetic transport only', () => {
  const stores: ReturnType<typeof makeStore>[] = [];
  let networkGuard: jest.SpyInstance;
  let consoleError: jest.SpyInstance;
  let consoleLog: jest.SpyInstance;
  beforeEach(() => {
    localStorage.clear();
    mockFetch.mockReset();
    mockPrivateUnmount.mockClear();
    networkGuard = jest.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('Real network forbidden'); });
    consoleError = jest.spyOn(console, 'error'); consoleLog = jest.spyOn(console, 'log');
    mockFetch.mockImplementation(async (input, init) => {
      const owner = credentialOf(input, init) === `Bearer ${tokenB}` ? 'b' : 'a';
      return pathOf(input, init) === '/users/me' ? response({ email: `synthetic-${owner}@example.invalid` }) : response(payload(owner));
    });
  });
  afterEach(() => {
    cleanup();
    completeSessionTransition(getSessionSnapshot().generation);
    act(() => stores.splice(0).forEach((store) => store.dispatch(baseApi.util.resetApiState())));
    try {
      expect(networkGuard).not.toHaveBeenCalled(); expect(consoleError).not.toHaveBeenCalled(); expect(consoleLog).not.toHaveBeenCalled();
    } finally { jest.restoreAllMocks(); }
  });
  const mount = (path = '/expenses', frames: string[] = []) => {
    localStorage.setItem('token', tokenA);
    const store = makeStore(); stores.push(store);
    const view = render(appTree(store, path, frames));
    return { store, rerenderApp: () => view.rerender(appTree(store, path, frames)), ...view };
  };
  const changeTo = async (store: ReturnType<typeof makeStore>, token: string) => {
    let completion!: Promise<number | null>;
    act(() => { completion = store.dispatch(completeLogin(token, getSessionSnapshot().generation)); });
    await act(async () => { await completion; });
  };
  const signedOut = async (store: ReturnType<typeof makeStore>) => {
    let completion!: Promise<number | null>;
    act(() => { completion = store.dispatch(logout()); });
    await act(async () => { await completion; });
  };

  it('establishes a bootstrap generation and keeps an authenticated refresh on its requested route', async () => {
    const generation = getSessionSnapshot().generation;
    const { store } = mount('/income');
    expect(isCurrentSession(generation)).toBe(true);
    expect(screen.getByTestId('location')).toHaveTextContent('/income');
    await screen.findByText('synthetic-owner-a');
    expect(store.getState().authorization.isAuthenticated).toBe(true);
    expect(getSessionSnapshot().generation).toBe(generation);
  });

  it('unmounts old subscriptions before new credentials and never commits cached A rows/profile under B', async () => {
    const frames: string[] = [];
    const { store } = mount('/expenses', frames);
    await screen.findByText('synthetic-owner-a');
    await screen.findByText('synthetic-a@example.invalid');
    const initialGeneration = getSessionSnapshot().generation;
    const bRequestCleanupCounts: number[] = [];
    const transport = mockFetch.getMockImplementation()!;
    mockFetch.mockImplementation((input, init) => {
      if (credentialOf(input, init) === `Bearer ${tokenB}`) bRequestCleanupCounts.push(mockPrivateUnmount.mock.calls.length);
      return transport(input, init);
    });
    frames.length = 0;
    await changeTo(store, tokenB);
    await screen.findByText('synthetic-owner-b');
    expect(getSessionSnapshot().generation).toBeGreaterThan(initialGeneration);
    for (const frame of frames) expect(frame).not.toMatch(/synthetic-owner-a|synthetic-a@example.invalid/);
    const bRows = mockFetch.mock.calls.filter(([input, init]) => pathOf(input, init) === '/expenses' && credentialOf(input, init) === `Bearer ${tokenB}`);
    expect(bRows).toHaveLength(1);
    expect(bRequestCleanupCounts.length).toBeGreaterThan(0);
    expect(bRequestCleanupCounts.every((count) => count > 0)).toBe(true);
  });

  it.each(['a-first', 'b-first'] as const)('suppresses late A payload even when cancellation is unavailable (%s)', async (order) => {
    const old = deferred<Response>(); const fresh = deferred<Response>();
    mockFetch.mockImplementation(async (input, init) => {
      if (pathOf(input, init) === '/users/me') return response({ email: 'synthetic@example.invalid' });
      return credentialOf(input, init) === `Bearer ${tokenB}` ? fresh.promise : old.promise;
    });
    const { store } = mount();
    await waitFor(() => expect(mockFetch.mock.calls.some(([input, init]) => pathOf(input, init) === '/expenses')).toBe(true));
    // Exercise the result guard, not just abort: simulate an uncooperative request.
    store.dispatch(baseApi.util.getRunningQueriesThunk()).forEach((request) => { request.abort = () => {}; });
    await changeTo(store, tokenB);
    if (order === 'b-first') {
      await act(async () => { fresh.resolve(response(payload('b'))); });
      await screen.findByText('synthetic-owner-b');
      await act(async () => { old.resolve(response(payload('a'))); });
    } else {
      await act(async () => { old.resolve(response(payload('a'))); });
      expect(screen.queryByText('synthetic-owner-a')).not.toBeInTheDocument();
      await act(async () => { fresh.resolve(response(payload('b'))); });
    }
    await screen.findByText('synthetic-owner-b');
    expect(expenseApi.endpoints.getExpenses.select(args)(store.getState()).data?.expenses[0]._id).toBe('synthetic-owner-b');
    expect(JSON.stringify(store.getState())).not.toContain('synthetic-owner-a');
  });

  it.each([401, 403])('old A /me %i cannot log out B even if it ignores abort', async (status) => {
    const old = deferred<Response>();
    mockFetch.mockImplementation(async (input, init) => pathOf(input, init) === '/users/me'
      ? credentialOf(input, init) === `Bearer ${tokenA}` ? old.promise : response({ email: 'synthetic-b@example.invalid' })
      : response(payload(credentialOf(input, init) === `Bearer ${tokenB}` ? 'b' : 'a')));
    const { store } = mount();
    await screen.findByText('synthetic-owner-a');
    store.dispatch(baseApi.util.getRunningQueriesThunk()).forEach((request) => { request.abort = () => {}; });
    await changeTo(store, tokenB); await screen.findByText('synthetic-b@example.invalid');
    await act(async () => { old.resolve(response({ message: 'Synthetic obsolete denial' }, status)); });
    expect(localStorage.getItem('token')).toBe(tokenB);
    expect(store.getState().authorization.isAuthenticated).toBe(true);
    expect(screen.getByTestId('location')).toHaveTextContent('/expenses');
  });

  it.each([401, 403])('current B /me %i preserves the existing logout policy', async (status) => {
    const { store } = mount(); await screen.findByText('synthetic-owner-a');
    mockFetch.mockImplementation(async (input, init) => pathOf(input, init) === '/users/me'
      ? response({ message: 'Synthetic current denial' }, status) : response(payload('b')));
    await changeTo(store, tokenB);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/));
    expect(localStorage.getItem('token')).toBeNull();
    expect(store.getState().authorization.isAuthenticated).toBe(false);
    expect(Object.keys(store.getState().api.queries)).toHaveLength(0);
  });

  it('A -> B -> A and a fresh same-account login always fetch new data and generations', async () => {
    const { store } = mount(); await screen.findByText('synthetic-owner-a');
    const first = getSessionSnapshot().generation;
    await changeTo(store, tokenB); await screen.findByText('synthetic-owner-b');
    const second = getSessionSnapshot().generation;
    await changeTo(store, tokenA); await screen.findByText('synthetic-owner-a');
    const third = getSessionSnapshot().generation;
    await changeTo(store, tokenA); await screen.findByText('synthetic-owner-a');
    expect([first, second, third, getSessionSnapshot().generation]).toEqual([first, first + 1, first + 2, first + 3]);
    expect(mockFetch.mock.calls.filter(([input, init]) => pathOf(input, init) === '/expenses')).toHaveLength(4);
  });

  it('logout clears cache and active subscriptions cannot repopulate it with a late result', async () => {
    const old = deferred<Response>();
    mockFetch.mockImplementation(async (input, init) => pathOf(input, init) === '/users/me'
      ? response({ email: 'synthetic-a@example.invalid' }) : old.promise);
    const { store } = mount(); await screen.findByText('synthetic-a@example.invalid');
    store.dispatch(baseApi.util.getRunningQueriesThunk()).forEach((request) => { request.abort = () => {}; });
    await signedOut(store);
    const calls = mockFetch.mock.calls.length;
    await act(async () => { old.resolve(response(payload('a'))); });
    expect(Object.keys(store.getState().api.queries)).toHaveLength(0);
    expect(store.getState().user.user).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(calls);
    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });

  it('an ordinary /me network failure neither clears credentials nor erases financial form state', async () => {
    const { store } = mount();
    await screen.findByText('synthetic-owner-a');
    await screen.findByText('synthetic-a@example.invalid');
    fireEvent.change(screen.getByRole('textbox', { name: 'Synthetic financial draft' }), { target: { value: 'synthetic-unsubmitted' } });
    const generation = getSessionSnapshot().generation;
    act(() => store.dispatch({ type: 'editExpenseModal/open' }));
    const before = store.getState();
    expect(before.editExpenseModal.open).toBe(true);
    mockFetch.mockImplementation(async () => response({ message: 'Synthetic unavailable' }, 503));
    await act(async () => { await store.dispatch(userApi.endpoints.getMe.initiate(undefined, { forceRefetch: true, subscribe: false })); });
    await waitFor(() => expect(userApi.endpoints.getMe.select()(store.getState()).isError).toBe(true));
    expect(localStorage.getItem('token')).toBe(tokenA);
    expect(getSessionSnapshot().generation).toBe(generation);
    expect(store.getState().editExpenseModal).toEqual(before.editExpenseModal);
    expect(screen.getByRole('textbox', { name: 'Synthetic financial draft' })).toHaveValue('synthetic-unsubmitted');
    expect(screen.getByTestId('location')).toHaveTextContent('/expenses');
  });

  it('ordinary rerenders reuse the same cache without new network calls', async () => {
    const { rerenderApp } = mount(); await screen.findByText('synthetic-owner-a');
    await screen.findByText('synthetic-a@example.invalid');
    const calls = mockFetch.mock.calls.length;
    rerenderApp();
    expect(mockFetch).toHaveBeenCalledTimes(calls);
  });

  it('logout supersedes an uncommitted login handoff without writing B credentials', async () => {
    const { store } = mount(); await screen.findByText('synthetic-owner-a');
    let login!: Promise<number | null>; let leaving!: Promise<number | null>;
    const generation = getSessionSnapshot().generation;
    act(() => {
      login = store.dispatch(completeLogin(tokenB, generation));
      leaving = store.dispatch(logout());
    });
    await expect(login).resolves.toBeNull();
    await leaving;
    expect(localStorage.getItem('token')).toBeNull();
    expect(store.getState().authorization.isAuthenticated).toBe(false);
    expect(mockFetch.mock.calls.some(([input, init]) => credentialOf(input, init) === `Bearer ${tokenB}`)).toBe(false);
  });

  it('a late successful login mutation after logout cannot establish a session', async () => {
    const signIn = deferred<Response>();
    const { store } = mount(); await screen.findByText('synthetic-owner-a');
    mockFetch.mockImplementation(async () => signIn.promise);
    const generation = getSessionSnapshot().generation;
    const login = store.dispatch(authApi.endpoints.login.initiate({ email: 'synthetic@example.invalid', password: 'synthetic-password' }));
    await waitFor(() => expect(mockFetch.mock.calls.some(([input, init]) => pathOf(input, init) === '/signin')).toBe(true));
    await signedOut(store);
    const rejection = expect(login.unwrap()).rejects.toEqual({ status: 'CUSTOM_ERROR', error: 'SESSION_CHANGED' });
    await act(async () => { signIn.resolve(response({ token: tokenB })); await rejection; });
    expect(await store.dispatch(completeLogin(tokenB, generation))).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(store.getState().authorization.isAuthenticated).toBe(false);
  });

  it('preserves a current auth mutation result until explicit successful transition; a failed login keeps A', async () => {
    const { store } = mount(); await screen.findByText('synthetic-owner-a');
    const generation = getSessionSnapshot().generation;
    mockFetch.mockImplementation(async () => response({ message: 'Synthetic failure' }, 401));
    const failed = store.dispatch(authApi.endpoints.login.initiate({ email: 'synthetic@example.invalid', password: 'synthetic-password' }));
    await expect(failed.unwrap()).rejects.toMatchObject({ status: 401 });
    expect(getSessionSnapshot().generation).toBe(generation);
    expect(localStorage.getItem('token')).toBe(tokenA);
    mockFetch.mockImplementation(async (input, init) => pathOf(input, init) === '/signin' ? response({ token: tokenB })
      : pathOf(input, init) === '/users/me' ? response({ email: 'synthetic-b@example.invalid' }) : response(payload('b')));
    const login = store.dispatch(authApi.endpoints.login.initiate({ email: 'synthetic@example.invalid', password: 'synthetic-password' }));
    const result = await login.unwrap();
    expect(result.token).toBe(tokenB);
    expect(getSessionSnapshot().generation).toBe(generation);
    await changeTo(store, result.token); await screen.findByText('synthetic-owner-b');
  });

  it('suppresses obsolete wire data/error/meta independently of query cancellation', async () => {
    const { store } = mount(); await screen.findByText('synthetic-owner-a');
    const result = deferred<Awaited<ReturnType<ReturnType<typeof import('@reduxjs/toolkit/query').fetchBaseQuery>>>>();
    const guarded = withSessionBoundary(() => result.promise);
    const api = { signal: new AbortController().signal, abort: () => {}, dispatch: store.dispatch,
      getState: store.getState, extra: undefined, endpoint: 'getExpenses', type: 'query' as const };
    const promise = guarded('/expenses', api, {});
    await changeTo(store, tokenB);
    result.resolve({ data: payload('a') });
    expect(await promise).toEqual({ error: { status: 'CUSTOM_ERROR', error: 'SESSION_CHANGED' } });
    expect(localStorage.getItem('token')).toBe(tokenB);
  });

  it('keeps current headers, results and errors intact, without mutating endpoint inputs', async () => {
    const { store } = mount(); await screen.findByText('synthetic-owner-a');
    const api = { signal: new AbortController().signal, abort: () => {}, dispatch: store.dispatch,
      getState: store.getState, extra: undefined, endpoint: 'getExpenses', type: 'query' as const };
    const input = Object.freeze({ url: '/expenses', headers: Object.freeze({ 'X-Synthetic': 'kept', 'X-Omitted': undefined }) });
    const success = { data: payload('a') };
    const guarded = withSessionBoundary((args) => {
      if (typeof args === 'string') throw new Error('Expected adapted request');
      if (!(args.headers instanceof Headers)) throw new Error('Expected normalized headers');
      const headers = args.headers;
      expect(headers.get('X-Synthetic')).toBe('kept'); expect(headers.has('X-Omitted')).toBe(false);
      expect(headers.get('Authorization')).toBe(`Bearer ${tokenA}`);
      return success;
    });
    expect(await guarded(input, api, {})).toBe(success);
    const currentError = { error: { status: 403, data: { message: 'Synthetic current error' } } };
    expect(await withSessionBoundary(() => currentError)('/expenses', api, {})).toBe(currentError);
    expect(input.headers).toEqual({ 'X-Synthetic': 'kept', 'X-Omitted': undefined });
  });
});
