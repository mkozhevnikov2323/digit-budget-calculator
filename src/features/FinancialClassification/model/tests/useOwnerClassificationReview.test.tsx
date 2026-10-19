import { configureStore } from '@reduxjs/toolkit';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { StrictMode, useLayoutEffect } from 'react';
import { MemoryRouter } from 'react-router';
import { baseApi } from 'shared/api/baseApi';
import { completeSessionTransition, getSessionSnapshot } from 'shared/api/sessionBoundary';
import rootReducer from '../../../../app/providers/store/rootReducer';
import { UserProvider } from '../../../../entities/User/ui/UserProvider';
import { userApi } from '../../../../entities/User/api/userApi';
import { expenseApi } from '../../../../entities/Expense/api/expenseApi';
import { incomeApi } from '../../../../entities/Income/api/incomeApi';
import { completeLogin } from '../../../../features/Authorization/model/authThunks';
import { useOwnerClassificationReview, type OwnerClassificationReview } from '../useOwnerClassificationReview';
import type { ReviewActionResult } from '../reviewSession';
import { expense, income, expenseResponse, incomeResponse } from '../../../FinancialAnalytics/model/tests/fixtures';
import { monthPeriod, type CalendarPeriod } from '../../../FinancialAnalytics/model/period';
import { toAnalyticsQueryParams } from '../../../FinancialAnalytics/model/apiRange';

const mockFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
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
const nativeSet = Storage.prototype.setItem;
const nativeRemove = Storage.prototype.removeItem;
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const requestOf = (input: RequestInfo | URL, init?: RequestInit) => input instanceof Request && !init ? input : new Request(input, init);
const urlOf = (input: RequestInfo | URL, init?: RequestInit) => new URL(requestOf(input, init).url);
const profile = (owner: string) => ({ _id: `synthetic-${owner}`, email: `synthetic-${owner}@example.invalid` });
const ownerOf = (input: RequestInfo | URL, init?: RequestInit) => requestOf(input, init).headers.get('Authorization') === `Bearer ${tokenB}` ? 'b' : 'a';
const bodyFor = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = urlOf(input, init); const owner = ownerOf(input, init);
  if (url.pathname === '/users/me') return profile(owner);
  const date = url.searchParams.get('startDate')!.slice(0, 10); const month = date.slice(0, 7);
  return url.pathname === '/expenses' ? expenseResponse([expense(`synthetic-e-${owner}-${month}`, 0.01, 'Еда', `${date}T12:00:00Z`)])
    : incomeResponse([income(`synthetic-i-${owner}-${month}`, 0.3, 'Synthetic source', `${date}T12:00:00Z`)]);
};
const normalTransport = async (input: RequestInfo | URL, init?: RequestInit) => response(bodyFor(input, init));
const deferred = () => {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; }); return { promise, resolve };
};
const month = (year = 2024, number = 2) => {
  const result = monthPeriod(year, number); if (!result.ok) throw new Error('Invalid fixture month'); return result.value;
};
const params = (period = month()) => {
  const result = toAnalyticsQueryParams(period); if (!result.ok) throw new Error('Invalid fixture params'); return result.value;
};
const makeStore = () => configureStore({ reducer: rootReducer, middleware: (defaults) => defaults().concat(baseApi.middleware) });
type TestStore = ReturnType<typeof makeStore>;
type Frame = { state: OwnerClassificationReview; period: string | undefined; generation: number };
const Probe = ({ period, accept }: { period: CalendarPeriod | null; accept: (state: OwnerClassificationReview) => void }) => {
  const state = useOwnerClassificationReview(period);
  useLayoutEffect(() => { accept(state); });
  return <output data-testid="review">{JSON.stringify(state)}</output>;
};
const tree = (store: TestStore, period: CalendarPeriod | null, accept: (state: OwnerClassificationReview) => void, show = true, unrelated = 0) => (
  <Provider store={store}><MemoryRouter><UserProvider><span>{unrelated}</span>
    {show && <Probe period={period} accept={accept} />}
  </UserProvider></MemoryRouter></Provider>
);

describe('headless temporary review with real endpoints, session boundary and mocked transport', () => {
  const stores: TestStore[] = [];
  let networkGuard: jest.SpyInstance;
  let log: jest.SpyInstance;
  let error: jest.SpyInstance;
  let writes: jest.SpyInstance;
  let removes: jest.SpyInstance;
  let sessionWrites: jest.Mock;
  let indexedOpen: jest.Mock;
  let indexedDescriptor: PropertyDescriptor | undefined;
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear(); mockFetch.mockReset(); mockFetch.mockImplementation(normalTransport);
    networkGuard = jest.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('Real network forbidden'); });
    log = jest.spyOn(console, 'log'); error = jest.spyOn(console, 'error');
    sessionWrites = jest.fn();
    writes = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(this: Storage, key: string, value: string) {
      if (this === sessionStorage) sessionWrites(); nativeSet.call(this, key, value);
    });
    removes = jest.spyOn(Storage.prototype, 'removeItem');
    indexedOpen = jest.fn(() => { throw new Error('Persistence forbidden'); });
    indexedDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: { open: indexedOpen } });
  });
  afterEach(() => {
    cleanup(); completeSessionTransition(getSessionSnapshot().generation);
    act(() => stores.splice(0).forEach((store) => store.dispatch(baseApi.util.resetApiState())));
    try {
      expect(networkGuard).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled();
      expect(sessionWrites).not.toHaveBeenCalled(); expect(indexedOpen).not.toHaveBeenCalled();
      expect(writes.mock.calls.every(([key]) => key === 'token')).toBe(true);
      for (const [input, init] of mockFetch.mock.calls) {
        const request = requestOf(input, init); expect(request.method).toBe('GET');
        expect(['/users/me', '/expenses', '/incomes']).toContain(urlOf(input, init).pathname);
      }
    } finally {
      jest.restoreAllMocks();
      if (indexedDescriptor) Object.defineProperty(globalThis, 'indexedDB', indexedDescriptor); else Reflect.deleteProperty(globalThis, 'indexedDB');
    }
  });
  const setup = (period: CalendarPeriod | null = month(), token: string | null = tokenA, show = true) => {
    if (token) nativeSet.call(localStorage, 'token', token);
    const store = makeStore(); stores.push(store); const frames: Frame[] = [];
    let current: OwnerClassificationReview | undefined; let selected = period;
    const accept = (state: OwnerClassificationReview) => { current = state; frames.push({ state, period: selected?.firstDate.slice(0, 7), generation: getSessionSnapshot().generation }); };
    const view = render(tree(store, period, accept, show));
    return { ...view, store, frames, read: () => current!,
      rerender: (next: CalendarPeriod | null = selected, shown = true, unrelated = 0) => { selected = next; view.rerender(tree(store, next, accept, shown, unrelated)); },
    };
  };
  type Hook = ReturnType<typeof setup>;
  const ready = async (hook: Hook) => {
    await waitFor(() => expect(hook.read()?.status).toBe('ready'));
    const state = hook.read(); if (state.status !== 'ready') throw new Error('Expected fictional ready data'); return state;
  };
  const financialCalls = (path?: string) => mockFetch.mock.calls.filter(([input, init]) => {
    const current = urlOf(input, init).pathname; return path ? current === path : current !== '/users/me';
  });
  const login = async (store: TestStore, token: string) => {
    let completion!: Promise<number | null>;
    act(() => { completion = store.dispatch(completeLogin(token, getSessionSnapshot().generation)); });
    await act(async () => { await completion; });
  };

  // Do not await a commit-acknowledgement promise inside the act callback:
  // React must commit first. Every helper checks the explicit final outcome.
  const approve = async (hook: Hook) => {
    const state = await ready(hook); let completion!: Promise<ReviewActionResult>;
    act(() => { completion = state.actions.approve(state.entries[0].operation, { economicRole: 'ordinary_expense', layer: 'everyday' }); });
    expect(await completion).toEqual({ ok: true }); return ready(hook);
  };
  const emptyDecisions = (state: Extract<OwnerClassificationReview, { status: 'ready' }>) => {
    expect(state.entries.every((entry) => entry.decision === null && entry.resolution.state === 'unclassified')).toBe(true);
  };
  const noCapabilities = (state: OwnerClassificationReview) => {
    for (const field of ['context', 'entries', 'actions', 'data', 'decisions']) expect(state).not.toHaveProperty(field);
  };

  it('initial acceptance is manual-only, exposes checked snapshots and adds no GETs', async () => {
    const hook = setup(); const state = await ready(hook); emptyDecisions(state);
    expect(state.revisionAuthority).toBe('caller_local'); expect(state.entries).toHaveLength(2);
    expect(financialCalls()).toHaveLength(2); expect(writes).not.toHaveBeenCalled();
    const approved = await approve(hook);
    expect(approved.entries[0].decision).toMatchObject({ provenance: { kind: 'manual' }, state: 'approved',
      operation: state.entries[0].operation, taxonomyVersion: state.context.taxonomyVersion });
    expect(approved.entries[1].decision).toBeNull(); expect(financialCalls()).toHaveLength(2);
  });
  it('approval acknowledges only after a valid transition commits', async () => {
    const hook = setup(); const state = await ready(hook); let completion!: Promise<ReviewActionResult>; let settled = false;
    act(() => {
      completion = state.actions.approve(state.entries[0].operation, { economicRole: 'ordinary_expense', layer: 'emergency' });
      completion.then(() => { settled = true; });
      expect(settled).toBe(false); expect(hook.read()).toBe(state);
    });
    expect(await completion).toEqual({ ok: true });
    expect(hook.read().status).toBe('ready');
    expect(hook.frames.some(({ state: frame }) => frame.status === 'ready' && frame.entries[0].resolution.state === 'approved')).toBe(true);
  });
  it('batched actions on separate operations both commit; a superseded same-operation action cannot report success', async () => {
    const hook = setup(); const state = await ready(hook); let first!: Promise<ReviewActionResult>; let second!: Promise<ReviewActionResult>;
    act(() => {
      first = state.actions.approve(state.entries[0].operation, { economicRole: 'ordinary_expense', layer: 'irregular' });
      second = state.actions.approve(state.entries[1].operation, { economicRole: 'ordinary_income', layer: null });
    });
    expect(await first).toEqual({ ok: true }); expect(await second).toEqual({ ok: true });
    const approved = await ready(hook); expect(approved.entries.every((entry) => entry.resolution.state === 'approved')).toBe(true);
    act(() => {
      first = approved.actions.leaveUnclassified(approved.entries[0].operation);
      second = approved.actions.reset(approved.entries[0].operation);
    });
    expect(await first).toEqual({ ok: false, error: { code: 'superseded' } }); expect(await second).toEqual({ ok: true });
    const reset = await ready(hook); expect(reset.entries[0].decision).toBeNull(); expect(reset.entries[1]).toBe(approved.entries[1]);
  });
  it('explicit-unclassified differs from reset and neither creates requests or persistence', async () => {
    const hook = setup(); const state = await approve(hook); let completion!: Promise<ReviewActionResult>;
    act(() => { completion = state.actions.leaveUnclassified(state.entries[0].operation); }); expect(await completion).toEqual({ ok: true });
    const left = await ready(hook); expect(left.entries[0].resolution.state).toBe('explicit_unclassified');
    expect(left.entries[0].decision?.provenance).toEqual({ kind: 'manual' });
    act(() => { completion = left.actions.reset(left.entries[0].operation); }); expect(await completion).toEqual({ ok: true });
    emptyDecisions(await ready(hook)); expect(financialCalls()).toHaveLength(2); expect(writes).not.toHaveBeenCalled(); expect(removes).not.toHaveBeenCalled();
  });
  it('rejects foreign and stale snapshots explicitly without altering accepted entries or leaking them in errors', async () => {
    const hook = setup(); const state = await ready(hook); let completion!: Promise<ReviewActionResult>;
    act(() => { completion = state.actions.approve({ ...state.entries[0].operation, ownerScope: 'foreign-owner' },
      { economicRole: 'ordinary_expense', layer: 'everyday' }); });
    expect(await completion).toEqual({ ok: false, error: { code: 'owner_mismatch' } }); expect(hook.read()).toBe(state);
    act(() => { completion = state.actions.reset({ ...state.entries[0].operation, revision: 'stale-private-revision' }); });
    expect(await completion).toEqual({ ok: false, error: { code: 'stale_decision' } }); expect(hook.read()).toBe(state);
    emptyDecisions(await ready(hook));
  });
  it('ordinary rerenders preserve decisions and action handles without duplicate transitions or GETs', async () => {
    const hook = setup(); const state = await approve(hook);
    hook.rerender({ ...month() }, true, 1); hook.rerender({ ...month() }, true, 2);
    expect(hook.read()).toBe(state); expect(financialCalls()).toHaveLength(2);
    expect(state.entries[0].decision?.revision).toBe('review-1');
  });
  it.each(['expenses', 'incomes'] as const)('%s refetch immediately hides drafts; identical payload never restores them', async (dataset) => {
    const hook = setup(); const old = await approve(hook); const pending = deferred(); let body: unknown;
    mockFetch.mockImplementation((input, init) => {
      if (urlOf(input, init).pathname === `/${dataset}`) { body = bodyFor(input, init); return pending.promise; }
      return normalTransport(input, init);
    });
    hook.frames.length = 0;
    act(() => {
      if (dataset === 'expenses') hook.store.dispatch(expenseApi.endpoints.getExpenses.initiate(params(), { forceRefetch: true, subscribe: false }));
      else hook.store.dispatch(incomeApi.endpoints.getIncomes.initiate(params(), { forceRefetch: true, subscribe: false }));
    });
    await waitFor(() => expect(hook.read().status).toBe('fetching')); noCapabilities(hook.read());
    expect(hook.frames.every(({ state }) => state.status !== 'ready')).toBe(true);
    expect(await old.actions.reset(old.entries[0].operation)).toMatchObject({ ok: false });
    await act(async () => { pending.resolve(response(body)); }); const fresh = await ready(hook); emptyDecisions(fresh);
    expect(fresh.context).not.toBe(old.context); expect(fresh.context.loadGeneration).not.toBe(old.context.loadGeneration);
    expect(await old.actions.approve(old.entries[0].operation, { economicRole: 'ordinary_expense', layer: 'everyday' })).toMatchObject({ ok: false });
    expect(financialCalls()).toHaveLength(4);
  });
  it('a delayed action racing refetch before render cannot commit an obsolete approval', async () => {
    const hook = setup(); const state = await ready(hook); const pending = deferred(); let completion!: Promise<ReviewActionResult>;
    mockFetch.mockImplementation((input, init) => urlOf(input, init).pathname === '/expenses' ? pending.promise : normalTransport(input, init));
    hook.frames.length = 0;
    act(() => {
      hook.store.dispatch(expenseApi.endpoints.getExpenses.initiate(params(), { forceRefetch: true, subscribe: false }));
      completion = state.actions.approve(state.entries[0].operation, { economicRole: 'ordinary_expense', layer: 'everyday' });
    });
    expect(await completion).toMatchObject({ ok: false });
    expect(hook.frames.every(({ state: frame }) => frame.status !== 'ready')).toBe(true);
    await act(async () => { pending.resolve(response(expenseResponse([expense('fresh')]))); }); emptyDecisions(await ready(hook));
  });
  it('period A -> B -> A never restores drafts or accepts an old callback', async () => {
    const hook = setup(); const old = await approve(hook);
    for (const period of [month(2024, 3), month()]) {
      hook.frames.length = 0; hook.rerender(period); const current = await ready(hook); emptyDecisions(current);
      expect(current.context).not.toBe(old.context);
      for (const frame of hook.frames) if (frame.state.status === 'ready') {
        expect(frame.state.context.periodKey).toBe(frame.period); expect(frame.state.entries.every((entry) => entry.decision === null)).toBe(true);
      }
    }
    expect(await old.actions.reset(old.entries[0].operation)).toMatchObject({ ok: false }); expect(financialCalls()).toHaveLength(6);
  });
  it('invalid selection closes capabilities and returning to the same month is empty', async () => {
    const hook = setup(); const old = await approve(hook); hook.frames.length = 0; hook.rerender(null);
    expect(hook.read()).toEqual({ status: 'blocked', reason: 'invalid_period' }); noCapabilities(hook.read());
    expect(hook.frames.every(({ state }) => state.status !== 'ready')).toBe(true);
    hook.rerender(month()); emptyDecisions(await ready(hook)); expect(await old.actions.reset(old.entries[0].operation)).toMatchObject({ ok: false });
  });
  it('verified-owner revalidation closes review synchronously and recovery is a new empty context', async () => {
    const hook = setup(); const old = await approve(hook); const pending = deferred();
    mockFetch.mockImplementation((input, init) => urlOf(input, init).pathname === '/users/me' ? pending.promise : normalTransport(input, init));
    hook.frames.length = 0;
    act(() => { hook.store.dispatch(userApi.endpoints.getMe.initiate(undefined, { forceRefetch: true, subscribe: false })); });
    await waitFor(() => expect(hook.read()).toEqual({ status: 'blocked', reason: 'verifying' })); noCapabilities(hook.read());
    expect(hook.frames.every(({ state }) => state.status !== 'ready')).toBe(true);
    await act(async () => { pending.resolve(response(profile('a'))); }); const current = await ready(hook); emptyDecisions(current);
    expect(current.context.sessionGeneration).toBe(old.context.sessionGeneration); expect(current.context).not.toBe(old.context);
    expect(await old.actions.reset(old.entries[0].operation)).toMatchObject({ ok: false });
  });
  it('owner A -> B -> A and same-owner new login expose no old records or drafts in committed frames', async () => {
    const hook = setup(); let old = await approve(hook);
    for (const [token, owner] of [[tokenB, 'synthetic-b'], [tokenA, 'synthetic-a'], [tokenA, 'synthetic-a']]) {
      hook.frames.length = 0; await login(hook.store, token); const current = await ready(hook); emptyDecisions(current);
      expect(current.context.userId).toBe(owner); expect(current.context).not.toBe(old.context);
      for (const frame of hook.frames) if (frame.state.status === 'ready') {
        expect(frame.state.context.userId).toBe(owner); expect(frame.state.context.sessionGeneration).toBe(frame.generation);
        expect(frame.state.entries.every((entry) => entry.operation.ownerScope === owner && entry.decision === null)).toBe(true);
      }
      expect(await old.actions.reset(old.entries[0].operation)).toMatchObject({ ok: false }); old = await approve(hook);
    }
    expect(financialCalls()).toHaveLength(8);
  });
  it('observed cross-tab logout immediately closes old callbacks, including one queued in the observation act', async () => {
    const hook = setup(); const old = await approve(hook); let completion!: Promise<ReviewActionResult>; hook.frames.length = 0;
    act(() => {
      nativeRemove.call(localStorage, 'token'); window.dispatchEvent(new StorageEvent('storage', { key: 'token', storageArea: localStorage }));
      completion = old.actions.reset(old.entries[0].operation);
    });
    expect(await completion).toMatchObject({ ok: false });
    await waitFor(() => expect(hook.read()).toEqual({ status: 'blocked', reason: 'unauthenticated' })); noCapabilities(hook.read());
    expect(hook.frames.every(({ state }) => state.status !== 'ready')).toBe(true);
    expect(writes).not.toHaveBeenCalled(); expect(removes).not.toHaveBeenCalled();
  });
  it('paired-load error discards all drafts and retry has no decisions from the failed round', async () => {
    const hook = setup(); const old = await approve(hook);
    mockFetch.mockImplementation((input, init) => urlOf(input, init).pathname === '/incomes' ? Promise.resolve(response({}, 503)) : normalTransport(input, init));
    act(() => { hook.store.dispatch(baseApi.util.invalidateTags(['Expense', 'Income'])); });
    await waitFor(() => expect(hook.read().status).toBe('error')); const failed = hook.read(); noCapabilities(failed);
    if (failed.status !== 'error' || !('retry' in failed)) throw new Error('Expected retryable data failure');
    expect(await old.actions.reset(old.entries[0].operation)).toMatchObject({ ok: false });
    const beforeRetry = financialCalls().length;
    mockFetch.mockImplementation(normalTransport); act(() => { failed.retry(); }); emptyDecisions(await ready(hook));
    expect(financialCalls()).toHaveLength(beforeRetry + 2);
  });
  it('remount is clean even when React useId and all textual accepted-context fields repeat', async () => {
    jest.spyOn(jest.requireActual<typeof import('react')>('react'), 'useId').mockReturnValue('deliberately-repeated');
    const first = setup(); const old = await approve(first); first.unmount();
    const second = setup(); const current = await ready(second); emptyDecisions(current);
    expect(current.context).toEqual(old.context); expect(current.context).not.toBe(old.context);
    expect(current.context.loadGeneration).toBe('deliberately-repeated/1');
    expect(await old.actions.approve(old.entries[0].operation, { economicRole: 'ordinary_expense', layer: 'everyday' }))
      .toEqual({ ok: false, error: { code: 'inactive_session' } });
    expect(second.read()).toBe(current); expect(financialCalls()).toHaveLength(4);
  });
  it('an action queued immediately before unmount never reports committed success', async () => {
    const hook = setup(); const state = await ready(hook); let completion!: Promise<ReviewActionResult>;
    act(() => {
      completion = state.actions.approve(state.entries[0].operation, { economicRole: 'ordinary_expense', layer: 'everyday' });
      hook.unmount();
    });
    expect(await completion).toEqual({ ok: false, error: { code: 'inactive_session' } });
  });
  it('a pending initial load and invalid financial response never expose review capabilities', async () => {
    const pending = deferred(); mockFetch.mockImplementation((input, init) => urlOf(input, init).pathname === '/users/me' ? normalTransport(input, init) : pending.promise.then((value) => value.clone()));
    const hook = setup(); await waitFor(() => expect(financialCalls()).toHaveLength(2)); expect(hook.read().status).toBe('loading'); noCapabilities(hook.read());
    await act(async () => { pending.resolve(response({})); }); await waitFor(() => expect(hook.read().status).toBe('error')); noCapabilities(hook.read());
  });
  it('StrictMode updater replay creates one manual decision and resolves one committed result', async () => {
    nativeSet.call(localStorage, 'token', tokenA); const store = makeStore(); stores.push(store);
    let current: OwnerClassificationReview | undefined;
    render(<StrictMode>{tree(store, month(), (state) => { current = state; })}</StrictMode>);
    await waitFor(() => expect(current?.status).toBe('ready'));
    const state = current; if (!state || state.status !== 'ready') throw new Error('Expected synthetic review');
    let completion!: Promise<ReviewActionResult>;
    act(() => { completion = state.actions.approve(state.entries[0].operation, { economicRole: 'ordinary_expense', layer: 'everyday' }); });
    expect(await completion).toEqual({ ok: true });
    const committed = current; if (!committed || committed.status !== 'ready') throw new Error('Expected committed review');
    expect(committed.entries[0].decision?.revision).toBe('review-1'); expect(committed.entries[1].decision).toBeNull();
    expect(financialCalls()).toHaveLength(2);
  });
});
