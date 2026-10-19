import { configureStore } from '@reduxjs/toolkit';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { Provider, useSelector } from 'react-redux';
import { Profiler, StrictMode, useEffect } from 'react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router';
import { baseApi } from '../baseApi';
import { completeSessionTransition, getSessionSnapshot } from '../sessionBoundary';
import rootReducer from '../../../app/providers/store/rootReducer';
import type { RootState } from '../../../app/providers/store/store';
import { Protected } from '../../../app/providers/router/ProtectedRoute';
import { InitAuth } from '../../../app/providers/init/InitAuth';
import { UserProvider } from '../../../entities/User/ui/UserProvider';
import { useVerifiedOwner } from '../../../entities/User/model/useVerifiedOwner';
import type { VerifiedOwnerState } from '../../../entities/User/model/verifiedOwner';
import { userApi, useGetMeQuery } from '../../../entities/User/api/userApi';
import { useGetExpensesQuery } from '../../../entities/Expense/api/expenseApi';
import { authApi } from '../../../features/Authorization/api/authApi';
import { completeLogin, logout } from '../../../features/Authorization/model/authThunks';
import { expense, expenseResponse } from '../../../features/FinancialAnalytics/model/tests/fixtures';

const mockFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
const mockPrivateUnmount = jest.fn();
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
const tokenC = 'synthetic-token-c';
const nativeSet = Storage.prototype.setItem;
const nativeRemove = Storage.prototype.removeItem;
const nativeClear = Storage.prototype.clear;
const args = { startDate: '2024-02-01T00:00:00.000Z', endDate: '2024-02-29T23:59:59.999Z', noPagination: true };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const profile = (owner: string) => ({ _id: `synthetic-${owner}`, email: `synthetic-${owner}@example.invalid` });
const payload = (owner: string) => expenseResponse([expense(`synthetic-row-${owner}`, 0.01)]);
const requestOf = (input: RequestInfo | URL, init?: RequestInit) =>
  input instanceof Request && init === undefined ? input : new Request(input, init);
const pathOf = (input: RequestInfo | URL, init?: RequestInit) => new URL(requestOf(input, init).url).pathname;
const ownerOf = (input: RequestInfo | URL, init?: RequestInit) => {
  const credential = requestOf(input, init).headers.get('Authorization');
  return credential === `Bearer ${tokenB}` ? 'b' : credential === `Bearer ${tokenC}` ? 'c' : 'a';
};
const normalTransport = async (input: RequestInfo | URL, init?: RequestInit) =>
  response(pathOf(input, init) === '/users/me' ? profile(ownerOf(input, init)) : payload(ownerOf(input, init)));
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
// The other tab changes the actual shared storage FIRST. Its writes bypass the
// spies on application writes; event.oldValue/newValue alone never set storage.
const writeExternal = (token: string | null) => token === null
  ? nativeRemove.call(localStorage, 'token') : nativeSet.call(localStorage, 'token', token);
const notify = (options: StorageEventInit = {}) => window.dispatchEvent(new StorageEvent('storage', {
  key: 'token', storageArea: localStorage, ...options,
}));
const external = (token: string | null) => {
  const oldValue = localStorage.getItem('token'); writeExternal(token);
  notify({ oldValue, newValue: token });
};
const makeStore = () => configureStore({ reducer: rootReducer, middleware: (defaults) => defaults().concat(baseApi.middleware) });
type TestStore = ReturnType<typeof makeStore>;
type Frame = { generation: number; transitioning: boolean; owner: VerifiedOwnerState | null; text: string };
const readOwner = (): VerifiedOwnerState => JSON.parse(screen.getByTestId('owner').textContent!);
const Owner = () => <output data-testid="owner">{JSON.stringify(useVerifiedOwner())}</output>;
const SharedMe = () => { useGetMeQuery(undefined, { skip: !localStorage.getItem('token') }); return null; };
const Location = () => <div data-testid="location">{useLocation().pathname}</div>;
const PrivateRows = () => {
  useEffect(() => () => { mockPrivateUnmount(); }, []);
  const query = useGetExpensesQuery(args);
  const user = useSelector((state: RootState) => state.user.user);
  return <><Location /><div data-testid="rows">{query.data?.expenses[0]?._id ?? 'none'}</div>
    <div data-testid="profile">{user?.email ?? 'none'}</div></>;
};
const tree = (store: TestStore, frames: Frame[], strict = false) => {
  const content = <Provider store={store}><MemoryRouter initialEntries={['/expenses']}>
    <Profiler id="cross-tab" onRender={() => {
      const text = screen.queryByTestId('owner')?.textContent;
      const session = getSessionSnapshot();
      frames.push({ generation: session.generation, transitioning: session.transitioning,
        owner: text ? JSON.parse(text) as VerifiedOwnerState : null, text: document.body.textContent ?? '' });
    }}><UserProvider><InitAuth /><Owner /><SharedMe /><Routes>
      <Route path="/" element={<Location />} />
      <Route path="/expenses" element={<Protected><PrivateRows /></Protected>} />
    </Routes></UserProvider></Profiler>
  </MemoryRouter></Provider>;
  return strict ? <StrictMode>{content}</StrictMode> : content;
};

describe('cross-tab isolation with real RTK, production lifecycle, fictional transport', () => {
  const stores: TestStore[] = [];
  let networkGuard: jest.SpyInstance;
  let consoleError: jest.SpyInstance;
  let consoleLog: jest.SpyInstance;
  let appSet: jest.SpyInstance;
  let appRemove: jest.SpyInstance;
  let appClear: jest.SpyInstance;
  beforeEach(() => {
    localStorage.clear(); mockFetch.mockReset(); mockPrivateUnmount.mockClear();
    networkGuard = jest.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('Real network forbidden'); });
    consoleError = jest.spyOn(console, 'error'); consoleLog = jest.spyOn(console, 'log');
    appSet = jest.spyOn(Storage.prototype, 'setItem');
    appRemove = jest.spyOn(Storage.prototype, 'removeItem');
    appClear = jest.spyOn(Storage.prototype, 'clear');
    mockFetch.mockImplementation(normalTransport);
  });
  afterEach(() => {
    cleanup(); completeSessionTransition(getSessionSnapshot().generation);
    act(() => stores.splice(0).forEach((store) => store.dispatch(baseApi.util.resetApiState())));
    try {
      expect(networkGuard).not.toHaveBeenCalled(); expect(consoleError).not.toHaveBeenCalled(); expect(consoleLog).not.toHaveBeenCalled();
      for (const [input, init] of mockFetch.mock.calls) {
        const request = requestOf(input, init); const path = pathOf(input, init);
        expect((request.method === 'GET' && ['/users/me', '/expenses'].includes(path)) ||
          (request.method === 'POST' && path === '/signin')).toBe(true);
      }
    } finally { jest.restoreAllMocks(); }
  });
  const mount = (strict = false) => {
    writeExternal(tokenA); const store = makeStore(); stores.push(store); const frames: Frame[] = [];
    const view = render(tree(store, frames, strict));
    return { store, frames, unmount: view.unmount, rerender: () => view.rerender(tree(store, frames, strict)) };
  };
  const verified = async (owner = 'a') => {
    await waitFor(() => expect(readOwner()).toEqual({ status: 'verified', owner: {
      userId: `synthetic-${owner}`, sessionGeneration: getSessionSnapshot().generation,
    } }));
  };
  const ready = async (owner = 'a') => { await verified(owner); await screen.findByText(`synthetic-row-${owner}`); };
  const freshFrames = (frames: Frame[], owner: string) => {
    for (const frame of frames) {
      if (frame.owner?.status === 'verified') {
        expect(frame.transitioning).toBe(false);
        expect(frame.owner.owner).toEqual({ userId: `synthetic-${owner}`, sessionGeneration: frame.generation });
      }
      expect(frame.text).not.toMatch(/synthetic-row-a|synthetic-a@example.invalid/);
    }
  };
  const uncooperative = (store: TestStore) => {
    const running = store.dispatch(baseApi.util.getRunningQueriesThunk());
    running.forEach((request) => { request.abort = () => {}; }); return running;
  };
  const refetchMe = async (store: TestStore) => {
    await act(async () => { await store.dispatch(userApi.endpoints.getMe.initiate(undefined, { forceRefetch: true, subscribe: false })); });
  };

  it('external logout revokes owner/cache/profile without writing shared storage or echoing logout', async () => {
    const { store, frames } = mount(); await ready(); frames.length = 0;
    const generation = getSessionSnapshot().generation;
    act(() => { external(null); expect(getSessionSnapshot().transitioning).toBe(true); });
    await waitFor(() => expect(readOwner()).toEqual({ status: 'unauthenticated' }));
    expect(getSessionSnapshot().generation).toBe(generation + 1);
    expect(store.getState().user.user).toBeNull(); expect(store.getState().authorization.isAuthenticated).toBe(false);
    expect(Object.keys(store.getState().api.queries)).toHaveLength(0);
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
    expect(appSet).not.toHaveBeenCalled(); expect(appRemove).not.toHaveBeenCalled(); expect(appClear).not.toHaveBeenCalled();
    for (const frame of frames) expect(frame.owner?.status).not.toBe('verified');
    act(() => { notify(); window.dispatchEvent(new Event('focus')); });
    expect(getSessionSnapshot().generation).toBe(generation + 1); expect(mockFetch).toHaveBeenCalledTimes(2);
  });
  it('external replacement verifies fresh B only after A subscriptions are detached', async () => {
    const { store, frames, rerender } = mount(); await ready(); frames.length = 0;
    const pending = deferred<Response>(); const cleanupCounts: number[] = [];
    mockFetch.mockImplementation((input, init) => {
      if (ownerOf(input, init) === 'b') cleanupCounts.push(mockPrivateUnmount.mock.calls.length);
      return pathOf(input, init) === '/users/me' ? pending.promise : normalTransport(input, init);
    });
    act(() => { external(tokenB); });
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(4));
    expect(readOwner()).toEqual({ status: 'verifying' }); expect(store.getState().user.user).toBeNull();
    expect(cleanupCounts.every((count) => count > 0)).toBe(true);
    await act(async () => { pending.resolve(response(profile('b'))); }); await ready('b'); freshFrames(frames, 'b');
    rerender(); act(() => { notify({ oldValue: tokenA, newValue: tokenB }); window.dispatchEvent(new Event('focus')); });
    expect(mockFetch).toHaveBeenCalledTimes(4); expect(appSet).not.toHaveBeenCalled(); expect(appRemove).not.toHaveBeenCalled();
  });
  it.each(['a-first', 'b-first'] as const)('suppresses uncooperative old private success (%s)', async (order) => {
    const oldMe = deferred<Response>(); const oldRows = deferred<Response>(); const bMe = deferred<Response>();
    mockFetch.mockImplementation((input, init) => ownerOf(input, init) === 'a'
      ? pathOf(input, init) === '/users/me' ? oldMe.promise : oldRows.promise
      : pathOf(input, init) === '/users/me' ? bMe.promise : normalTransport(input, init));
    const { store, frames } = mount(); await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    const running = uncooperative(store); act(() => { external(tokenB); }); frames.length = 0;
    if (order === 'b-first') { await act(async () => { bMe.resolve(response(profile('b'))); }); await ready('b'); }
    await act(async () => { oldMe.resolve(response(profile('a'))); oldRows.resolve(response(payload('a'))); await Promise.all(running); });
    if (order === 'a-first') {
      expect(readOwner()).toEqual({ status: 'verifying' }); await act(async () => { bMe.resolve(response(profile('b'))); });
    }
    await ready('b'); freshFrames(frames, 'b'); expect(JSON.stringify(store.getState())).not.toMatch(/synthetic-row-a|synthetic-a@example.invalid/);
  });
  it.each([401, 403])('late old /me %i cannot delete B after observed replacement', async (status) => {
    const old = deferred<Response>();
    mockFetch.mockImplementation((input, init) => ownerOf(input, init) === 'a' && pathOf(input, init) === '/users/me' ? old.promise : normalTransport(input, init));
    const { store } = mount(); await screen.findByText('synthetic-row-a'); const running = uncooperative(store);
    act(() => { external(tokenB); }); await ready('b');
    await act(async () => { old.resolve(response({ message: 'Synthetic old denial' }, status)); await Promise.all(running); });
    await verified('b'); expect(localStorage.getItem('token')).toBe(tokenB); expect(appRemove).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent('/expenses');
  });
  it.each([401, 403])('settling old /me %i detects changed storage before its event and cannot delete B', async (status) => {
    const old = deferred<Response>();
    mockFetch.mockImplementation((input, init) => ownerOf(input, init) === 'a' && pathOf(input, init) === '/users/me' ? old.promise : normalTransport(input, init));
    const { store } = mount(); await screen.findByText('synthetic-row-a'); const running = uncooperative(store);
    writeExternal(tokenB); // No browser notification yet.
    await act(async () => { old.resolve(response({ message: 'Synthetic old denial' }, status)); await Promise.all(running); });
    await ready('b'); expect(appRemove).not.toHaveBeenCalled(); expect(localStorage.getItem('token')).toBe(tokenB);
    const generation = getSessionSnapshot().generation; act(() => { notify(); });
    expect(getSessionSnapshot().generation).toBe(generation);
  });
  it('coalesces rapid A -> B -> C handoffs into requests for the final credential only', async () => {
    const { frames } = mount(); await ready(); frames.length = 0; const generation = getSessionSnapshot().generation;
    act(() => { external(tokenB); expect(getSessionSnapshot().transitioning).toBe(true); external(tokenC); });
    await ready('c'); freshFrames(frames, 'c'); expect(getSessionSnapshot().generation).toBe(generation + 2);
    expect(mockFetch.mock.calls.filter(([input, init]) => ownerOf(input, init) === 'b')).toHaveLength(0);
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
  it('external logout immediately followed by login adopts the final login without a token-removal loop', async () => {
    mount(); await ready(); const generation = getSessionSnapshot().generation;
    act(() => { external(null); external(tokenB); }); await ready('b');
    expect(getSessionSnapshot().generation).toBe(generation + 2); expect(localStorage.getItem('token')).toBe(tokenB);
    expect(appSet).not.toHaveBeenCalled(); expect(appRemove).not.toHaveBeenCalled();
  });
  it('observed A -> B -> A creates fresh generations even when the previous credential bytes return', async () => {
    mount(); await ready(); const first = getSessionSnapshot().generation;
    act(() => { external(tokenB); }); await ready('b');
    act(() => { external(tokenA); }); await ready();
    expect(getSessionSnapshot().generation).toBe(first + 2); expect(mockFetch).toHaveBeenCalledTimes(6);
  });
  it('the same owner with a new external credential gets a fresh verified context', async () => {
    mount(); await ready(); const generation = getSessionSnapshot().generation;
    mockFetch.mockImplementation(async (input, init) => response(pathOf(input, init) === '/users/me' ? profile('a') : payload('a')));
    act(() => { external('synthetic-token-a-fresh'); }); await ready();
    expect(getSessionSnapshot().generation).toBe(generation + 1); expect(mockFetch).toHaveBeenCalledTimes(4);
  });
  it('ignores duplicate/no-op events and untrusted event payloads while actual storage is unchanged', async () => {
    mount(); await ready(); const generation = getSessionSnapshot().generation;
    act(() => {
      notify({ oldValue: tokenA, newValue: tokenB }); notify({ oldValue: null, newValue: null }); notify();
      window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('pageshow'));
    });
    await verified(); expect(getSessionSnapshot().generation).toBe(generation); expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(appSet).not.toHaveBeenCalled(); expect(appRemove).not.toHaveBeenCalled();
  });
  it('ignores unrelated keys, other storage areas and unspecified storage areas', async () => {
    mount(); await ready(); const generation = getSessionSnapshot().generation;
    writeExternal(tokenB);
    act(() => { notify({ key: 'unrelated' }); notify({ storageArea: sessionStorage }); notify({ key: null, storageArea: sessionStorage }); notify({ storageArea: null }); });
    expect(getSessionSnapshot().generation).toBe(generation); expect(mockFetch).toHaveBeenCalledTimes(2);
    act(() => { window.dispatchEvent(new Event('focus')); }); await ready('b');
  });
  it('handles localStorage.clear key=null using actual storage and never echoes a write', async () => {
    const { store } = mount(); await ready();
    act(() => { nativeClear.call(localStorage); notify({ key: null }); });
    await waitFor(() => expect(readOwner()).toEqual({ status: 'unauthenticated' }));
    expect(Object.keys(store.getState().api.queries)).toHaveLength(0);
    expect(appClear).not.toHaveBeenCalled(); expect(appRemove).not.toHaveBeenCalled();
  });
  it('StrictMode registers one active listener of each kind and removes all listeners on unmount', async () => {
    const addWindow = jest.spyOn(window, 'addEventListener'); const removeWindow = jest.spyOn(window, 'removeEventListener');
    const addDocument = jest.spyOn(document, 'addEventListener'); const removeDocument = jest.spyOn(document, 'removeEventListener');
    const { unmount } = mount(true); await ready();
    const active = (add: jest.SpyInstance, remove: jest.SpyInstance, name: string) => {
      const listeners = new Set(add.mock.calls.filter(([event]) => event === name).map(([, listener]) => listener));
      remove.mock.calls.filter(([event]) => event === name).forEach(([, listener]) => listeners.delete(listener)); return listeners.size;
    };
    for (const name of ['storage', 'focus', 'pageshow']) expect(active(addWindow, removeWindow, name)).toBe(1);
    expect(active(addDocument, removeDocument, 'visibilitychange')).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    act(() => { external(tokenB); }); await ready('b'); expect(mockFetch).toHaveBeenCalledTimes(4);
    unmount();
    for (const name of ['storage', 'focus', 'pageshow']) expect(active(addWindow, removeWindow, name)).toBe(0);
    expect(active(addDocument, removeDocument, 'visibilitychange')).toBe(0);
    const generation = getSessionSnapshot().generation; external(tokenC);
    expect(getSessionSnapshot().generation).toBe(generation); expect(mockFetch).toHaveBeenCalledTimes(4);
  });
  it.each(['focus', 'pageshow', 'visibilitychange'])('resume fallback %s notices an undelivered change exactly once', async (event) => {
    mount(); await ready(); const generation = getSessionSnapshot().generation;
    writeExternal(tokenB);
    const visibility = jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    act(() => { (event === 'visibilitychange' ? document : window).dispatchEvent(new Event(event)); }); await ready('b');
    act(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('pageshow')); document.dispatchEvent(new Event('visibilitychange')); notify(); });
    expect(getSessionSnapshot().generation).toBe(generation + 1); expect(mockFetch).toHaveBeenCalledTimes(4); visibility.mockRestore();
  });
  it('focus/resume and ordinary rerenders with unchanged credentials do not refetch', async () => {
    const { rerender } = mount(); await ready(); const generation = getSessionSnapshot().generation;
    act(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('pageshow')); }); rerender(); rerender();
    expect(getSessionSnapshot().generation).toBe(generation); expect(mockFetch).toHaveBeenCalledTimes(2);
  });
  it('an external event cancels an uncommitted local login rather than restoring its credential', async () => {
    const { store } = mount(); await ready();
    let login!: Promise<number | null>;
    act(() => { login = store.dispatch(completeLogin(tokenC, getSessionSnapshot().generation)); external(tokenB); });
    await expect(login).resolves.toBeNull(); await ready('b'); expect(localStorage.getItem('token')).toBe(tokenB);
    expect(appSet).not.toHaveBeenCalled();
  });
  it('a local login completing during an external transition is obsolete', async () => {
    const { store } = mount(); await ready(); const generation = getSessionSnapshot().generation;
    let login!: Promise<number | null>;
    act(() => { external(tokenB); login = store.dispatch(completeLogin(tokenC, generation)); });
    await expect(login).resolves.toBeNull(); await ready('b'); expect(appSet).not.toHaveBeenCalled();
  });
  it('a stale local logout during an external transition cannot erase its pending credential', async () => {
    const { store } = mount(); await ready(); let leaving!: Promise<number | null>;
    act(() => { external(tokenB); leaving = store.dispatch(logout()); });
    await expect(leaving).resolves.toBeNull(); await ready('b');
    expect(appRemove).not.toHaveBeenCalled(); expect(localStorage.getItem('token')).toBe(tokenB);
  });
  it.each([true, false])('local logout cannot erase a new external login during handoff (notification=%s)', async (notification) => {
    const { store } = mount(); await ready(); let leaving!: Promise<number | null>;
    act(() => {
      leaving = store.dispatch(logout());
      if (notification) external(tokenB); else writeExternal(tokenB);
    });
    await leaving; await ready('b'); expect(localStorage.getItem('token')).toBe(tokenB);
    expect(appRemove).not.toHaveBeenCalled(); expect(appSet).not.toHaveBeenCalled();
  });
  it('local login rechecks storage at the handoff even before the external event arrives', async () => {
    const { store } = mount(); await ready(); let login!: Promise<number | null>;
    act(() => { login = store.dispatch(completeLogin(tokenC, getSessionSnapshot().generation)); writeExternal(tokenB); });
    await expect(login).resolves.toBeNull(); await ready('b'); expect(appSet).not.toHaveBeenCalled();
  });
  it('a changed credential found at local action entry is adopted without an obsolete local write', async () => {
    const { store } = mount(); await ready(); writeExternal(tokenB);
    let login!: Promise<number | null>;
    act(() => { login = store.dispatch(completeLogin(tokenC, getSessionSnapshot().generation)); });
    await expect(login).resolves.toBeNull(); await ready('b'); expect(appSet).not.toHaveBeenCalled();
  });
  it('a stale local logout intent notices the external replacement at entry and preserves it', async () => {
    const { store } = mount(); await ready(); writeExternal(tokenB);
    act(() => { store.dispatch(logout()); }); await ready('b'); expect(appRemove).not.toHaveBeenCalled();
  });
  it('old-subtree query initiation notices external storage before dispatching HTTP with a new credential', async () => {
    const { store } = mount(); await ready(); writeExternal(tokenB);
    await refetchMe(store); await ready('b');
    expect(mockFetch).toHaveBeenCalledTimes(4); expect(mockPrivateUnmount.mock.calls.length).toBeGreaterThan(0);
  });
  it('local login acknowledges its own write and local logout still removes token once', async () => {
    const { store } = mount(); await ready(); let login!: Promise<number | null>;
    act(() => { login = store.dispatch(completeLogin(tokenB, getSessionSnapshot().generation)); }); await login; await ready('b');
    const generation = getSessionSnapshot().generation;
    act(() => { window.dispatchEvent(new Event('focus')); notify(); });
    expect(getSessionSnapshot().generation).toBe(generation); expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(appSet).toHaveBeenCalledTimes(1);
    let leaving!: Promise<number | null>; act(() => { leaving = store.dispatch(logout()); }); await leaving;
    await waitFor(() => expect(readOwner()).toEqual({ status: 'unauthenticated' }));
    expect(appRemove).toHaveBeenCalledTimes(1); expect(localStorage.getItem('token')).toBeNull();
  });
  it.each([401, 403])('preserves confirmed current-generation %i logout', async (status) => {
    const { store } = mount(); await ready();
    mockFetch.mockImplementation(async () => response({ message: 'Synthetic current denial' }, status)); await refetchMe(store);
    await waitFor(() => expect(readOwner()).toEqual({ status: 'unauthenticated' }));
    expect(localStorage.getItem('token')).toBeNull(); expect(appRemove).toHaveBeenCalledTimes(1);
  });
  it('transient network failure keeps credentials and generation without exposing old verified identity', async () => {
    const { store } = mount(); await ready(); const generation = getSessionSnapshot().generation;
    mockFetch.mockRejectedValue(new Error('Synthetic unavailable')); await refetchMe(store);
    await waitFor(() => expect(readOwner()).toEqual({ status: 'verification_error', reason: 'request_failed' }));
    expect(getSessionSnapshot().generation).toBe(generation); expect(localStorage.getItem('token')).toBe(tokenA);
    expect(appRemove).not.toHaveBeenCalled(); expect(screen.getByTestId('location')).toHaveTextContent('/expenses');
  });
  it('a deferred authentication result cannot install obsolete credentials after external login', async () => {
    const { store } = mount(); await ready(); const generation = getSessionSnapshot().generation; const signIn = deferred<Response>();
    mockFetch.mockImplementation((input, init) => pathOf(input, init) === '/signin' ? signIn.promise : normalTransport(input, init));
    const login = store.dispatch(authApi.endpoints.login.initiate({ email: 'synthetic@example.invalid', password: 'synthetic-password' }));
    await waitFor(() => expect(mockFetch.mock.calls.some(([input, init]) => pathOf(input, init) === '/signin')).toBe(true));
    act(() => { external(tokenB); }); await ready('b');
    const rejected = expect(login.unwrap()).rejects.toEqual({ status: 'CUSTOM_ERROR', error: 'SESSION_CHANGED' });
    await act(async () => { signIn.resolve(response({ token: tokenC })); await rejected; });
    expect(await store.dispatch(completeLogin(tokenC, generation))).toBeNull();
    expect(localStorage.getItem('token')).toBe(tokenB); expect(appSet).not.toHaveBeenCalled();
  });
});
