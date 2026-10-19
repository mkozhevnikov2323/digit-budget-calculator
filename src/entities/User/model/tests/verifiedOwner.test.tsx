import { configureStore } from '@reduxjs/toolkit';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { Provider, useSelector } from 'react-redux';
import { Profiler } from 'react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router';
import { baseApi } from 'shared/api/baseApi';
import { completeSessionTransition, getSessionSnapshot } from 'shared/api/sessionBoundary';
import rootReducer from '../../../../app/providers/store/rootReducer';
import type { RootState } from '../../../../app/providers/store/store';
import { Protected } from '../../../../app/providers/router/ProtectedRoute';
import { UserProvider } from '../../ui/UserProvider';
import { userApi, useGetMeQuery } from '../../api/userApi';
import { useVerifiedOwner } from '../useVerifiedOwner';
import { validateVerifiedOwner, type VerifiedOwnerState } from '../verifiedOwner';
import { completeLogin, logout } from '../../../../features/Authorization/model/authThunks';

const mockFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
// Actual application reducers, without loading unrelated UI barrels in Jest.
jest.mock('features/Authorization', () => ({
  authorizationReducer: jest.requireActual('../../../../features/Authorization/model/authorizationSlice').reducer,
  setAuthenticated: jest.requireActual('../../../../features/Authorization/model/authorizationSlice').setAuthenticated,
}));
jest.mock('entities/User', () => ({ userReducer: jest.requireActual('../../../../entities/User/model/userSlice').reducer }), { virtual: true });
jest.mock('entities/Income', () => ({ incomeReducer: jest.requireActual('../../../../entities/Income/model/incomeSlice').reducer }), { virtual: true });
jest.mock('entities/Expense', () => ({ expenseReducer: jest.requireActual('../../../../entities/Expense/model/expenseSlice').reducer }), { virtual: true });
jest.mock('entities/IncomeSource', () => ({ incomeSourceReducer: jest.requireActual('../../../../entities/IncomeSource/model/sourceSlice').incomeSourceReducer }), { virtual: true });
jest.mock('widgets/Modals/AddIncomeModal', () => ({ addIncomeModalReducer: jest.requireActual('../../../../widgets/Modals/AddIncomeModal/model/addIncomeModalSlice').addIncomeModalReducer }));
jest.mock('widgets/Modals/AddExpenseModal', () => ({ addExpenseModalReducer: jest.requireActual('../../../../widgets/Modals/AddExpenseModal/model/addExpenseModalSlice').addExpenseModalReducer }));
jest.mock('widgets/Modals/EditIncomeModal', () => ({ editIncomeModalReducer: jest.requireActual('../../../../widgets/Modals/EditIncomeModal/model/editIncomeModalSlice').editIncomeModalReducer }));
jest.mock('widgets/Modals/EditExpenseModal', () => ({ editExpenseModalReducer: jest.requireActual('../../../../widgets/Modals/EditExpenseModal/model/editExpenseModalSlice').editExpenseModalReducer }));
jest.mock('shared/api/baseApi', () => {
  const { createApi, fetchBaseQuery } = jest.requireActual<typeof import('@reduxjs/toolkit/query/react')>('@reduxjs/toolkit/query/react');
  const { withSessionBoundary } = jest.requireActual<typeof import('../../../../shared/api/sessionBaseQuery')>('../../../../shared/api/sessionBaseQuery');
  const http = fetchBaseQuery({ baseUrl: 'https://owner.invalid', fetchFn: (...args: Parameters<typeof fetch>) => mockFetch(...args) });
  return { baseApi: createApi({ reducerPath: 'api', endpoints: () => ({}),
    // Only adapt JSDOM's AbortSignal to Node Request, as in PR #17 tests.
    // Keep the actual production session/header/result guard outside this adapter.
    baseQuery: withSessionBoundary((args, api, options) => http({ ...(typeof args === 'string' ? { url: args } : args), signal: undefined }, api, options)),
    tagTypes: ['Income', 'User', 'Source', 'Expense', 'Balance', 'ExpenseCategory', 'Recipients', 'ExpenseTitles'],
  }) };
});

const tokenA = 'synthetic-token-a';
const tokenB = 'synthetic-token-b';
const profile = (id = 'synthetic-a') => ({ _id: id, email: `${id}@example.invalid` });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
const makeStore = () => configureStore({ reducer: rootReducer, middleware: (defaults) => defaults().concat(baseApi.middleware) });
type TestStore = ReturnType<typeof makeStore>;
type Frame = { session: ReturnType<typeof getSessionSnapshot>; states: VerifiedOwnerState[] };
const readOwner = (name = 'first'): VerifiedOwnerState => JSON.parse(screen.getByTestId(`owner-${name}`).textContent!);
const Probe = ({ name }: { name: string }) => {
  const owner = useVerifiedOwner();
  return <output data-testid={`owner-${name}`}>{JSON.stringify(owner)}</output>;
};
const SharedSubscriber = () => {
  useGetMeQuery(undefined, { skip: !localStorage.getItem('token') });
  return null;
};
const Location = () => <div data-testid="location">{useLocation().pathname}</div>;
const Profile = () => <div data-testid="profile">{useSelector((state: RootState) => state.user.user)?.email ?? 'none'}</div>;
const tree = (store: TestStore, frames: Frame[]) => (
  <Provider store={store}><MemoryRouter initialEntries={['/expenses']}>
    <Profiler id="owner" onRender={() => {
      frames.push({ session: getSessionSnapshot(), states: ['first', 'second'].flatMap((name) => {
        const text = screen.queryByTestId(`owner-${name}`)?.textContent;
        return text ? [JSON.parse(text) as VerifiedOwnerState] : [];
      }) });
    }}>
      <UserProvider><Probe name="first" /><Probe name="second" /><SharedSubscriber /><Profile />
        <Routes><Route path="/" element={<Location />} />
          <Route path="/expenses" element={<Protected><Location /></Protected>} /></Routes>
      </UserProvider>
    </Profiler>
  </MemoryRouter></Provider>
);
const invalidPayloads: [string, unknown][] = [
  ['missing ID', { email: 'synthetic@example.invalid' }],
  ['empty ID', { _id: '' }], ['whitespace ID', { _id: ' \t' }],
  ['embedded whitespace', { _id: 'synthetic a' }], ['leading whitespace', { _id: ' a' }],
  ['trailing whitespace', { _id: 'a\n' }], ['unicode whitespace', { _id: 'a\u00a0b' }],
  ['numeric ID', { _id: 123 }], ['object ID', { _id: {} }], ['array ID', { _id: ['a'] }],
  ['null ID', { _id: null }], ['boolean ID', { _id: true }],
  ['null response', null], ['array response', [profile()]], ['string response', 'synthetic'],
  ['number response', 42], ['boolean response', false],
];

describe('pure verified owner response validation', () => {
  it('copies only canonical ID and supplied generation, without imposing an ObjectId pattern', () => {
    const input = Object.freeze({ ...profile('fictional:owner/1'), token: 'synthetic-extra-field' });
    expect(validateVerifiedOwner(input, 7)).toEqual({ status: 'verified', owner: { userId: input._id, sessionGeneration: 7 } });
    expect(validateVerifiedOwner({ _id: 'another-id' }, 7).status).toBe('verified');
  });
  it.each(invalidPayloads)('rejects %s without returning payload or identity', (_name, payload) => {
    const result = validateVerifiedOwner(payload, 7);
    expect(result.status).toBe('verification_error');
    expect(Object.keys(result).sort()).toEqual(['reason', 'status']);
  });
  it('rejects inherited IDs rather than treating them as server JSON fields', () => {
    expect(validateVerifiedOwner(Object.create({ _id: 'synthetic-a' }), 7)).toEqual({ status: 'verification_error', reason: 'invalid_user_id' });
  });
  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid generation %s', (generation) => {
    expect(validateVerifiedOwner(profile(), generation)).toEqual({ status: 'verification_error', reason: 'invalid_generation' });
  });
});

describe('verified owner with actual RTK Query, UserProvider and session transitions', () => {
  const stores: TestStore[] = [];
  let networkGuard: jest.SpyInstance;
  let consoleError: jest.SpyInstance;
  let consoleLog: jest.SpyInstance;
  beforeEach(() => {
    localStorage.clear(); mockFetch.mockReset();
    networkGuard = jest.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('Real network forbidden'); });
    consoleError = jest.spyOn(console, 'error'); consoleLog = jest.spyOn(console, 'log');
    mockFetch.mockImplementation(async (input, init) => {
      const request = new Request(input, init);
      if (new URL(request.url).pathname !== '/users/me' || request.method !== 'GET') throw new Error('Unexpected endpoint');
      return response(profile(request.headers.get('Authorization') === `Bearer ${tokenB}` ? 'synthetic-b' : 'synthetic-a'));
    });
  });
  afterEach(() => {
    cleanup(); completeSessionTransition(getSessionSnapshot().generation);
    act(() => stores.splice(0).forEach((store) => store.dispatch(baseApi.util.resetApiState())));
    try {
      expect(networkGuard).not.toHaveBeenCalled(); expect(consoleError).not.toHaveBeenCalled(); expect(consoleLog).not.toHaveBeenCalled();
    } finally { jest.restoreAllMocks(); }
  });
  const newStore = () => { const store = makeStore(); stores.push(store); return store; };
  const mount = (token: string | null = tokenA, store = newStore(), frames: Frame[] = []) => {
    if (token) localStorage.setItem('token', token);
    const view = render(tree(store, frames));
    return { store, frames, rerender: () => view.rerender(tree(store, frames)), unmount: view.unmount };
  };
  const verified = async (id = 'synthetic-a') => {
    await waitFor(() => expect(readOwner()).toEqual({ status: 'verified', owner: { userId: id, sessionGeneration: getSessionSnapshot().generation } }));
    expect(readOwner('second')).toEqual(readOwner());
  };
  const changeTo = async (store: TestStore, token: string) => {
    let completion!: Promise<number | null>;
    act(() => { completion = store.dispatch(completeLogin(token, getSessionSnapshot().generation)); });
    await act(async () => { await completion; });
  };
  const refetch = async (store: TestStore) => {
    await act(async () => { await store.dispatch(userApi.endpoints.getMe.initiate(undefined, { forceRefetch: true, subscribe: false })); });
  };

  it('has no owner or request without credentials and preserves protected-route behavior', async () => {
    mount(null);
    expect(readOwner()).toEqual({ status: 'unauthenticated' });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
  });
  it('fails closed outside the provider', () => {
    render(<Probe name="first" />);
    expect(readOwner()).toEqual({ status: 'verification_error', reason: 'provider_missing' });
  });
  it('loads, verifies and shares one GET across consumers and rerenders without persisting identity', async () => {
    const pending = deferred<Response>(); mockFetch.mockReturnValue(pending.promise);
    const { rerender } = mount();
    const writes = jest.spyOn(Storage.prototype, 'setItem');
    const removes = jest.spyOn(Storage.prototype, 'removeItem');
    expect(readOwner()).toEqual({ status: 'verifying' });
    expect(screen.getByTestId('location')).toHaveTextContent('/expenses');
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    await act(async () => { pending.resolve(response(profile())); });
    await verified();
    expect(screen.getByTestId('profile')).toHaveTextContent('synthetic-a@example.invalid');
    rerender(); rerender();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(writes).not.toHaveBeenCalled(); expect(removes).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(1); expect(sessionStorage.length).toBe(0);
    expect(Object.keys(readOwner())).toEqual(['status', 'owner']);
  });
  it.each(invalidPayloads)('fails closed for real endpoint %s without removing credentials or navigating', async (_name, payload) => {
    mockFetch.mockResolvedValue(response(payload));
    mount();
    await waitFor(() => expect(readOwner().status).toBe('verification_error'));
    expect(Object.keys(readOwner()).sort()).toEqual(['reason', 'status']);
    expect(localStorage.getItem('token')).toBe(tokenA);
    expect(screen.getByTestId('location')).toHaveTextContent('/expenses');
  });
  it('keeps the legacy email profile even when missing _id blocks the new capability', async () => {
    mockFetch.mockResolvedValue(response({ email: 'synthetic@example.invalid' }));
    const { store } = mount();
    await waitFor(() => expect(readOwner()).toEqual({ status: 'verification_error', reason: 'invalid_user_id' }));
    expect(store.getState().user.user).toEqual({ email: 'synthetic@example.invalid' });
  });
  it('does not trust a fulfilled cache on mount before a fresh authenticated response', async () => {
    localStorage.setItem('token', tokenA);
    const store = newStore();
    const handle = store.dispatch(userApi.endpoints.getMe.initiate()); await handle; handle.unsubscribe();
    const fresh = deferred<Response>(); mockFetch.mockReturnValue(fresh.promise);
    const { frames } = mount(tokenA, store);
    expect(readOwner()).toEqual({ status: 'verifying' });
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(frames.every((frame) => frame.states.every((state) => state.status !== 'verified'))).toBe(true);
    await act(async () => { fresh.resolve(response(profile())); }); await verified();
  });
  it('hides cached identity during refetch and on a transient network failure without logging out', async () => {
    const { store } = mount(); await verified();
    const generation = getSessionSnapshot().generation;
    const pending = deferred<Response>(); mockFetch.mockReturnValue(pending.promise);
    let request!: ReturnType<ReturnType<typeof userApi.endpoints.getMe.initiate>>;
    act(() => { request = store.dispatch(userApi.endpoints.getMe.initiate(undefined, { forceRefetch: true, subscribe: false })); });
    await waitFor(() => expect(readOwner()).toEqual({ status: 'verifying' }));
    await act(async () => { pending.resolve(response({ message: 'Synthetic unavailable' }, 503)); await request; });
    await waitFor(() => expect(readOwner()).toEqual({ status: 'verification_error', reason: 'request_failed' }));
    expect(getSessionSnapshot().generation).toBe(generation); expect(localStorage.getItem('token')).toBe(tokenA);
    expect(screen.getByTestId('location')).toHaveTextContent('/expenses');
    expect(store.getState().user.user?.email).toBe('synthetic-a@example.invalid');
    mockFetch.mockRejectedValue(new Error('Synthetic connection unavailable')); await refetch(store);
    expect(readOwner()).toEqual({ status: 'verification_error', reason: 'request_failed' });
    expect(localStorage.getItem('token')).toBe(tokenA);
    mockFetch.mockResolvedValue(response(profile())); await refetch(store); await verified();
  });
  it.each([401, 403])('preserves current-session %i logout without any owner in denied commits', async (status) => {
    const { store, frames } = mount(); await verified(); frames.length = 0;
    mockFetch.mockResolvedValue(response({ message: 'Synthetic denial' }, status));
    await refetch(store);
    await waitFor(() => expect(readOwner()).toEqual({ status: 'unauthenticated' }));
    expect(localStorage.getItem('token')).toBeNull();
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
    expect(frames.every((frame) => frame.states.every((state) => state.status !== 'verified'))).toBe(true);
  });
  it('isolates A -> B -> A and a same-owner login by fresh generations without mixed commits', async () => {
    const { store, frames } = mount(); await verified();
    const first = getSessionSnapshot().generation;
    for (const [token, id] of [[tokenB, 'synthetic-b'], [tokenA, 'synthetic-a'], [tokenA, 'synthetic-a']]) {
      frames.length = 0; const before = getSessionSnapshot().generation;
      await changeTo(store, token); await verified(id);
      expect(getSessionSnapshot().generation).toBe(before + 1);
      for (const frame of frames) for (const state of frame.states) if (state.status === 'verified') {
        expect(frame.session.transitioning).toBe(false);
        expect(state.owner).toEqual({ userId: id, sessionGeneration: frame.session.generation });
      }
    }
    expect(getSessionSnapshot().generation).toBe(first + 3); expect(mockFetch).toHaveBeenCalledTimes(4);
  });
  it.each(['a-first', 'b-first'] as const)('ignores an uncooperative late A success (%s)', async (order) => {
    const old = deferred<Response>(); const fresh = deferred<Response>();
    mockFetch.mockImplementation((input, init) => new Request(input, init).headers.get('Authorization') === `Bearer ${tokenB}` ? fresh.promise : old.promise);
    const { store, frames } = mount();
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [oldRequest] = store.dispatch(baseApi.util.getRunningQueriesThunk()); oldRequest.abort = () => {};
    await changeTo(store, tokenB); frames.length = 0;
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    if (order === 'b-first') { await act(async () => { fresh.resolve(response(profile('synthetic-b'))); }); await verified('synthetic-b'); }
    await act(async () => { old.resolve(response(profile())); await oldRequest; });
    if (order === 'a-first') {
      expect(readOwner()).toEqual({ status: 'verifying' });
      await act(async () => { fresh.resolve(response(profile('synthetic-b'))); });
    }
    await verified('synthetic-b');
    expect(JSON.stringify(store.getState().api)).not.toContain('synthetic-a');
    for (const frame of frames) for (const state of frame.states) if (state.status === 'verified') expect(state.owner.userId).toBe('synthetic-b');
  });
  it.each([401, 403])('ignores late A %i without logging out verified B', async (status) => {
    const old = deferred<Response>();
    mockFetch.mockImplementation((input, init) => new Request(input, init).headers.get('Authorization') === `Bearer ${tokenB}`
      ? Promise.resolve(response(profile('synthetic-b'))) : old.promise);
    const { store } = mount(); await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [oldRequest] = store.dispatch(baseApi.util.getRunningQueriesThunk()); oldRequest.abort = () => {};
    await changeTo(store, tokenB); await verified('synthetic-b');
    await act(async () => { old.resolve(response({ message: 'Synthetic obsolete denial' }, status)); await oldRequest; });
    await verified('synthetic-b'); expect(localStorage.getItem('token')).toBe(tokenB);
  });
  it('removes owner on the logout transition and cannot revive it from a late response', async () => {
    const { store, frames } = mount(); await verified();
    const pending = deferred<Response>(); mockFetch.mockReturnValue(pending.promise);
    act(() => { store.dispatch(userApi.endpoints.getMe.initiate(undefined, { forceRefetch: true, subscribe: false })); });
    await waitFor(() => expect(readOwner()).toEqual({ status: 'verifying' }));
    const [oldRequest] = store.dispatch(baseApi.util.getRunningQueriesThunk()); oldRequest.abort = () => {};
    frames.length = 0;
    let completion!: Promise<number | null>;
    act(() => { completion = store.dispatch(logout()); expect(getSessionSnapshot().transitioning).toBe(true); });
    await act(async () => { await completion; pending.resolve(response(profile())); await oldRequest; });
    expect(readOwner()).toEqual({ status: 'unauthenticated' });
    for (const frame of frames) for (const state of frame.states) expect(state.status).not.toBe('verified');
    expect(Object.keys(store.getState().api.queries)).toHaveLength(0);
  });
  it('revokes a verified owner immediately on logout without waiting for an in-flight query', async () => {
    const { store, frames } = mount(); await verified(); frames.length = 0;
    let completion!: Promise<number | null>;
    act(() => { completion = store.dispatch(logout()); });
    expect(screen.queryByText(/"status":"verified"/)).not.toBeInTheDocument();
    await act(async () => { await completion; });
    expect(readOwner()).toEqual({ status: 'unauthenticated' });
    for (const frame of frames) for (const state of frame.states) expect(state.status).not.toBe('verified');
  });
  it('rejects a changed ID within one generation until a fresh credential lifecycle', async () => {
    const { store, frames } = mount(); await verified(); frames.length = 0;
    mockFetch.mockResolvedValue(response(profile('synthetic-b'))); await refetch(store);
    await waitFor(() => expect(readOwner()).toEqual({ status: 'verification_error', reason: 'identity_changed' }));
    for (const frame of frames) for (const state of frame.states) if (state.status === 'verified') expect(state.owner.userId).not.toBe('synthetic-b');
    mockFetch.mockImplementation(async () => response(profile())); await refetch(store);
    expect(readOwner()).toEqual({ status: 'verification_error', reason: 'identity_changed' });
    await changeTo(store, tokenA); await verified();
  });
});
