import { configureStore } from '@reduxjs/toolkit';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { useLayoutEffect } from 'react';
import { MemoryRouter } from 'react-router';
import { baseApi } from 'shared/api/baseApi';
import { completeSessionTransition, getSessionSnapshot } from 'shared/api/sessionBoundary';
import rootReducer from '../../../../app/providers/store/rootReducer';
import { UserProvider } from '../../../../entities/User/ui/UserProvider';
import { userApi } from '../../../../entities/User/api/userApi';
import { expenseApi } from '../../../../entities/Expense/api/expenseApi';
import { incomeApi } from '../../../../entities/Income/api/incomeApi';
import { completeLogin } from '../../../../features/Authorization/model/authThunks';
import { useOwnerClassificationData, type OwnerClassificationData } from '../useOwnerClassificationData';
import * as adapter from '../snapshotAdapter';
import * as validation from '../../../FinancialAnalytics/model/validation';
import { expense, income, expenseResponse, incomeResponse, selectedPeriod } from '../../../FinancialAnalytics/model/tests/fixtures';
import { monthPeriod, quarterPeriod, type CalendarPeriod } from '../../../FinancialAnalytics/model/period';
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
const freeze = <T,>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value;
};
const makeStore = () => configureStore({ reducer: rootReducer, middleware: (defaults) => defaults().concat(baseApi.middleware) });
type TestStore = ReturnType<typeof makeStore>;
type Frame = { state: OwnerClassificationData; period: string | undefined; generation: number };
const Probe = ({ period, accept }: { period: CalendarPeriod | null; accept: (state: OwnerClassificationData) => void }) => {
  const state = useOwnerClassificationData(period);
  useLayoutEffect(() => { accept(state); });
  return <output data-testid="review">{JSON.stringify(state)}</output>;
};
const tree = (store: TestStore, period: CalendarPeriod | null, accept: (state: OwnerClassificationData) => void, show = true, unrelated = 0) => (
  <Provider store={store}><MemoryRouter><UserProvider><span>{unrelated}</span>
    {show && <Probe period={period} accept={accept} />}
  </UserProvider></MemoryRouter></Provider>
);

describe('owner classification paired GETs with actual session, validators and adapter', () => {
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
    let current: OwnerClassificationData | undefined; let selected = period;
    const accept = (state: OwnerClassificationData) => { current = state; frames.push({ state, period: selected?.firstDate.slice(0, 7), generation: getSessionSnapshot().generation }); };
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
  const uncooperative = (store: TestStore) => {
    const running = store.dispatch(baseApi.util.getRunningQueriesThunk()); running.forEach((request) => { request.abort = () => {}; }); return running;
  };
  const login = async (store: TestStore, token: string) => {
    let completion!: Promise<number | null>;
    act(() => { completion = store.dispatch(completeLogin(token, getSessionSnapshot().generation)); });
    await act(async () => { await completion; });
  };

  it('missing credentials blocks every GET and exposes no records', () => {
    const hook = setup(month(), null); expect(hook.read()).toEqual({ status: 'blocked', reason: 'unauthenticated' });
    expect(mockFetch).not.toHaveBeenCalled();
  });
  it('identity verification must finish before either financial request starts', async () => {
    const pending = deferred(); mockFetch.mockReturnValue(pending.promise);
    const hook = setup(); expect(hook.read()).toEqual({ status: 'blocked', reason: 'verifying' });
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1)); expect(financialCalls()).toHaveLength(0);
    mockFetch.mockImplementation(normalTransport);
    await act(async () => { pending.resolve(response(profile('a'))); }); await ready(hook);
    expect(financialCalls()).toHaveLength(2);
  });
  it.each([null, { email: 'synthetic@example.invalid' }, { _id: 'invalid owner' }])('invalid /me owner fails closed (%j)', async (payload) => {
    mockFetch.mockResolvedValue(response(payload)); const hook = setup();
    await waitFor(() => expect(hook.read()).toEqual({ status: 'blocked', reason: 'verification_error' }));
    expect(financialCalls()).toHaveLength(0); expect(removes).not.toHaveBeenCalled();
  });
  it('uses two existing GETs with identical full-month bounds and produces only checked snapshots', async () => {
    const hook = setup(); const state = await ready(hook);
    expect(financialCalls()).toHaveLength(2);
    for (const [input, init] of financialCalls()) {
      const request = requestOf(input, init); expect(request.method).toBe('GET'); expect(request.body).toBeNull();
      expect(Object.fromEntries(urlOf(input, init).searchParams)).toEqual({ startDate: '2024-02-01T00:00:00.000Z',
        endDate: '2024-02-29T23:59:59.999Z', noPagination: 'true' });
    }
    expect(state.context).toEqual({ userId: 'synthetic-a', sessionGeneration: getSessionSnapshot().generation,
      periodKey: '2024-02', loadGeneration: expect.any(String) });
    expect(state.data).toEqual({ revisionAuthority: 'caller_local', expenses: [{ ownerScope: 'synthetic-a', dataset: 'expenses',
      transactionId: 'synthetic-e-a-2024-02', revision: state.context.loadGeneration,
      facts: { timestamp: Date.parse('2024-02-01T12:00:00Z'), kopecks: 1, category: { kind: 'label', value: 'Еда', dictionaryStatus: 'unresolved' } } }],
    incomes: [{ ownerScope: 'synthetic-a', dataset: 'incomes', transactionId: 'synthetic-i-a-2024-02', revision: state.context.loadGeneration,
      facts: { timestamp: Date.parse('2024-02-01T12:00:00Z'), kopecks: 30, sourceLabel: 'Synthetic source' } }] });
    for (const frame of hook.frames) if (frame.state.status !== 'ready') {
      expect(frame.state).not.toHaveProperty('data'); expect(frame.state).not.toHaveProperty('context');
    }
    expect(writes).not.toHaveBeenCalled(); expect(sessionStorage.length).toBe(0);
  });
  it.each(['/expenses', '/incomes'])('a slow %s never exposes a partial accepted pair', async (slow) => {
    const pending = deferred(); let slowBody: unknown;
    mockFetch.mockImplementation((input, init) => {
      if (urlOf(input, init).pathname === slow) { slowBody = bodyFor(input, init); return pending.promise; }
      return normalTransport(input, init);
    });
    const hook = setup(); await waitFor(() => expect(financialCalls()).toHaveLength(2));
    expect(hook.read().status).toBe('loading'); expect(hook.frames.some((frame) => frame.state.status === 'ready')).toBe(false);
    await act(async () => { pending.resolve(response(slowBody)); }); await ready(hook);
  });
  it.each(['/expenses', '/incomes'])('%s failure is safe, stable and retries one fresh pair only on explicit command', async (failed) => {
    mockFetch.mockImplementation((input, init) => urlOf(input, init).pathname === failed
      ? Promise.resolve(response({ secret: 'synthetic-private-failure-body', amount: 99 }, 503)) : normalTransport(input, init));
    const hook = setup(); await waitFor(() => expect(hook.read().status).toBe('error'));
    const state = hook.read(); if (state.status !== 'error') throw new Error('Expected fictional error');
    expect(state.error).toEqual({ code: 'request_failed', dataset: failed === '/expenses' ? 'expenses' : 'incomes' });
    expect(JSON.stringify(state)).not.toMatch(/synthetic-|secret|amount|Authorization|Bearer/);
    hook.rerender(); expect(financialCalls()).toHaveLength(2); expect(removes).not.toHaveBeenCalled();
    mockFetch.mockImplementation(normalTransport);
    act(() => { state.retry(); state.retry(); }); await ready(hook); expect(financialCalls()).toHaveLength(4);
  });
  it('an error remains an error when its slow counterpart finishes, without automatic retry loops', async () => {
    const pending = deferred();
    mockFetch.mockImplementation((input, init) => urlOf(input, init).pathname === '/users/me' ? normalTransport(input, init)
      : urlOf(input, init).pathname === '/expenses' ? Promise.resolve(response({}, 503)) : pending.promise);
    const hook = setup(); await waitFor(() => expect(hook.read().status).toBe('error'));
    await act(async () => { pending.resolve(response(incomeResponse())); });
    expect(hook.read().status).toBe('error'); expect(financialCalls()).toHaveLength(2);
  });
  const invalid: [string, unknown, unknown, string][] = [
    ['precision', expenseResponse([expense('e', 1.005)]), incomeResponse(), 'invalid_amount'],
    ['invalid date', expenseResponse(), incomeResponse([income('i', 1, 's', '2024-02-30')]), 'invalid_date'],
    ['outside period', expenseResponse([expense('e', 1, 'x', '2024-03-01')]), incomeResponse(), 'outside_period'],
    ['duplicate expense IDs', expenseResponse([expense('e'), expense('e')]), incomeResponse(), 'duplicate_id'],
    ['duplicate income IDs', expenseResponse(), incomeResponse([income('i'), income('i')]), 'duplicate_id'],
    ['incomplete metadata', expenseResponse(), incomeResponse([], { total: 2 }), 'incomplete_response'],
    ['bad metadata', expenseResponse([], { page: 2 }), incomeResponse(), 'invalid_metadata'],
    ['malformed response', [], incomeResponse(), 'invalid_response'],
  ];
  it.each(invalid)('rejects %s before generating adapter descriptors', async (_name, expenses, incomes, code) => {
    const adapterSpy = jest.spyOn(adapter, 'buildClassificationSnapshots');
    mockFetch.mockImplementation(async (input, init) => urlOf(input, init).pathname === '/users/me' ? response(profile('a'))
      : response(urlOf(input, init).pathname === '/expenses' ? expenses : incomes));
    const hook = setup(); await waitFor(() => expect(hook.read()).toMatchObject({ status: 'error', error: { code } }));
    expect(adapterSpy).not.toHaveBeenCalled(); expect(hook.read()).not.toHaveProperty('data');
    expect(hook.frames.some((frame) => frame.state.status === 'ready')).toBe(false);
  });
  it('empty complete responses are a valid ready pair', async () => {
    mockFetch.mockImplementation(async (input, init) => response(urlOf(input, init).pathname === '/users/me' ? profile('a')
      : urlOf(input, init).pathname === '/expenses' ? expenseResponse() : incomeResponse()));
    const state = await ready(setup()); expect(state.data).toEqual({ revisionAuthority: 'caller_local', expenses: [], incomes: [] });
  });
  it('same transaction ID across collections stays distinct and exact category provenance survives', async () => {
    const rawExpenses = [{ _id: 'shared', amount: 0.01, date: '2024-02-10T12:00:00Z' }, expense('null', 0.01, null), expense('literal', 0.01, 'Без категории'),
      expense('empty', 0.01, ''), expense('spaces', 0.01, '  '), expense('unicode', 0.01, '  Еда 🍎 e\u0301  ')];
    const raw = freeze(expenseResponse(rawExpenses)); const incoming = freeze(incomeResponse([income('shared', 0.01)]));
    const before = JSON.stringify([raw, incoming]);
    mockFetch.mockImplementation(async (input, init) => response(urlOf(input, init).pathname === '/users/me' ? profile('a')
      : urlOf(input, init).pathname === '/expenses' ? raw : incoming));
    const state = await ready(setup());
    const byId = new Map(state.data.expenses.map((snapshot) => [snapshot.transactionId, snapshot.facts.category]));
    expect(byId.get('shared')).toEqual({ kind: 'absent' }); expect(byId.get('null')).toEqual({ kind: 'absent' });
    for (const [id, value] of [['literal', 'Без категории'], ['empty', ''], ['spaces', '  '], ['unicode', '  Еда 🍎 e\u0301  ']]) {
      expect(byId.get(id)).toEqual({ kind: 'label', value, dictionaryStatus: 'unresolved' });
    }
    expect(state.data.incomes[0].transactionId).toBe('shared'); expect(JSON.stringify([raw, incoming])).toBe(before);
  });
  it.each([null, selectedPeriod('2024-02-02', '2024-02-29'), selectedPeriod('2024-02-01', '2024-03-31'),
    { ...month(), startInclusive: month().startInclusive + 1 }, { ...month(), lastDate: 'invalid' },
    (() => { const result = quarterPeriod(2024, 1); if (!result.ok) throw new Error('Bad fixture'); return result.value; })(),
  ])('invalid or non-month period skips both financial queries (%j)', async (period) => {
    const hook = setup(period); await waitFor(() => expect(hook.read()).toEqual({ status: 'blocked', reason: 'invalid_period' }));
    expect(financialCalls()).toHaveLength(0);
  });
  it('an invalid selection immediately hides previous-month snapshots', async () => {
    const hook = setup(); await ready(hook); hook.frames.length = 0; hook.rerender(null);
    expect(hook.read()).toEqual({ status: 'blocked', reason: 'invalid_period' });
    expect(hook.frames.every((frame) => frame.state.status !== 'ready')).toBe(true); expect(financialCalls()).toHaveLength(2);
  });
  it('ordinary rerender uses the same publication and performs no repeated validation or GET', async () => {
    const adapterSpy = jest.spyOn(adapter, 'buildClassificationSnapshots'); const validator = jest.spyOn(validation, 'validateExpenseResponse');
    const hook = setup(); const state = await ready(hook); const validations = validator.mock.calls.length;
    hook.rerender({ ...month() }, true, 1); hook.rerender({ ...month() }, true, 2);
    expect(hook.read()).toBe(state); expect(financialCalls()).toHaveLength(2);
    expect(adapterSpy).toHaveBeenCalledTimes(1); expect(validator).toHaveBeenCalledTimes(validations);
  });
  it('old fulfilled cache alone cannot open a newly mounted review lifecycle', async () => {
    const hook = setup(month(), tokenA, false); await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const query = params(); await act(async () => { await Promise.all([
      hook.store.dispatch(expenseApi.endpoints.getExpenses.initiate(query)), hook.store.dispatch(incomeApi.endpoints.getIncomes.initiate(query)),
    ]); });
    const e = deferred(); const i = deferred();
    mockFetch.mockImplementation((input, init) => urlOf(input, init).pathname === '/expenses' ? e.promise : i.promise);
    hook.rerender(); await waitFor(() => expect(financialCalls()).toHaveLength(4));
    expect(hook.read().status).toBe('loading'); expect(hook.frames.some((frame) => frame.state.status === 'ready')).toBe(false);
    await act(async () => { e.resolve(response(expenseResponse())); i.resolve(response(incomeResponse())); }); await ready(hook);
  });
  it('shares identical already-running endpoint GETs with another subscriber', async () => {
    const hook = setup(month(), tokenA, false); await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const e = deferred(); const i = deferred(); mockFetch.mockImplementation((input, init) => urlOf(input, init).pathname === '/expenses' ? e.promise : i.promise);
    act(() => { hook.store.dispatch(expenseApi.endpoints.getExpenses.initiate(params())); hook.store.dispatch(incomeApi.endpoints.getIncomes.initiate(params())); });
    hook.rerender(); await waitFor(() => expect(financialCalls()).toHaveLength(2)); expect(hook.read().status).toBe('loading');
    await act(async () => { e.resolve(response(expenseResponse())); i.resolve(response(incomeResponse())); }); await ready(hook);
    expect(financialCalls()).toHaveLength(2);
  });
  it('A -> B -> A month selection cannot revive fulfilled old A ready', async () => {
    const hook = setup(); const a = await ready(hook); hook.rerender(month(2024, 3)); const b = await ready(hook);
    hook.frames.length = 0; hook.rerender(month()); expect(hook.read().status).not.toBe('ready'); const again = await ready(hook);
    expect([a.context.periodKey, b.context.periodKey, again.context.periodKey]).toEqual(['2024-02', '2024-03', '2024-02']);
    expect(new Set([a.context.loadGeneration, b.context.loadGeneration, again.context.loadGeneration]).size).toBe(3);
    expect(financialCalls()).toHaveLength(6);
  });
  it('returning to A while its obsolete requests are pending waits and requests fresh A after they settle', async () => {
    const oldE = deferred(); const oldI = deferred(); let firstE = true; let firstI = true;
    mockFetch.mockImplementation((input, init) => {
      const url = urlOf(input, init); if (url.searchParams.get('startDate')?.startsWith('2024-02')) {
        if (url.pathname === '/expenses' && firstE) { firstE = false; return oldE.promise; }
        if (url.pathname === '/incomes' && firstI) { firstI = false; return oldI.promise; }
      }
      return normalTransport(input, init);
    });
    const hook = setup(); await waitFor(() => expect(financialCalls()).toHaveLength(2));
    hook.rerender(month(2024, 3)); await ready(hook); hook.rerender(month()); hook.frames.length = 0;
    expect(hook.read().status).not.toBe('ready');
    await act(async () => { oldE.resolve(response(expenseResponse([expense('obsolete-old-a')]))); oldI.resolve(response(incomeResponse([income('obsolete-old-a')]))); });
    const state = await ready(hook); expect(JSON.stringify(state)).not.toContain('obsolete-old-a'); expect(financialCalls()).toHaveLength(6);
    for (const frame of hook.frames) if (frame.state.status === 'ready') expect(JSON.stringify(frame.state)).not.toContain('obsolete-old-a');
  });
  it.each(['expenses', 'incomes'] as const)('%s-only refetch requires one fresh counterpart and replaces identical-content revisions', async (dataset) => {
    const adapterSpy = jest.spyOn(adapter, 'buildClassificationSnapshots'); const hook = setup(); const before = await ready(hook);
    const counterpart = dataset === 'expenses' ? '/incomes' : '/expenses'; const pending = deferred(); let counterpartBody: unknown;
    const rawBefore = expenseApi.endpoints.getExpenses.select(params())(hook.store.getState()).data;
    mockFetch.mockImplementation((input, init) => {
      if (urlOf(input, init).pathname === counterpart) { counterpartBody = bodyFor(input, init); return pending.promise; }
      return normalTransport(input, init);
    });
    hook.frames.length = 0;
    act(() => { if (dataset === 'expenses') hook.store.dispatch(expenseApi.endpoints.getExpenses.initiate(params(), { forceRefetch: true, subscribe: false }));
      else hook.store.dispatch(incomeApi.endpoints.getIncomes.initiate(params(), { forceRefetch: true, subscribe: false })); });
    await waitFor(() => expect(financialCalls()).toHaveLength(4)); expect(hook.read().status).toBe('fetching');
    expect(hook.frames.every((frame) => frame.state.status !== 'ready')).toBe(true);
    await act(async () => { pending.resolve(response(counterpartBody)); }); const after = await ready(hook);
    expect(after.context.loadGeneration).not.toBe(before.context.loadGeneration);
    expect(after.data.expenses[0].revision).toBe(after.context.loadGeneration); expect(after.data.incomes[0].revision).toBe(after.context.loadGeneration);
    expect(expenseApi.endpoints.getExpenses.select(params())(hook.store.getState()).data).toBe(rawBefore);
    hook.rerender(); expect(financialCalls('/expenses')).toHaveLength(2); expect(financialCalls('/incomes')).toHaveLength(2);
    expect(adapterSpy).toHaveBeenCalledTimes(2);
    expect(new Set(hook.frames.flatMap((frame) => frame.state.status === 'ready' ? [frame.state.context.loadGeneration] : [])).size).toBe(1);
  });
  it.each(['Expense', 'Income', 'both'] as const)('tag invalidation %s coalesces into one complete fresh pair', async (tag) => {
    const hook = setup(); const before = await ready(hook);
    act(() => { hook.store.dispatch(baseApi.util.invalidateTags(tag === 'both' ? ['Expense', 'Income'] : [tag])); });
    await waitFor(() => expect(hook.read().status === 'ready' && hook.read() !== before).toBe(true));
    const after = await ready(hook); expect(after.context.loadGeneration).not.toBe(before.context.loadGeneration);
    expect(financialCalls('/expenses')).toHaveLength(2); expect(financialCalls('/incomes')).toHaveLength(2);
  });
  it('a refetch during initial paired loading cannot reuse its still-pending old counterpart', async () => {
    const firstIncome = deferred(); const freshIncome = deferred(); let incomeCalls = 0;
    mockFetch.mockImplementation((input, init) => {
      if (urlOf(input, init).pathname === '/incomes') return ++incomeCalls === 1 ? firstIncome.promise : freshIncome.promise;
      return normalTransport(input, init);
    });
    const hook = setup(); await waitFor(() => expect(financialCalls()).toHaveLength(2));
    await waitFor(() => expect(expenseApi.endpoints.getExpenses.select(params())(hook.store.getState()).isSuccess).toBe(true));
    await act(async () => { await hook.store.dispatch(expenseApi.endpoints.getExpenses.initiate(params(), { forceRefetch: true, subscribe: false })); });
    expect(hook.read().status).not.toBe('ready');
    await act(async () => { firstIncome.resolve(response(incomeResponse([income('retired-income')]))); });
    await waitFor(() => expect(incomeCalls).toBe(2)); expect(hook.read().status).not.toBe('ready');
    await act(async () => { freshIncome.resolve(response(incomeResponse([income('fresh-income')]))); });
    const state = await ready(hook); expect(state.data.incomes[0].transactionId).toBe('fresh-income');
    expect(financialCalls('/expenses')).toHaveLength(2); expect(financialCalls('/incomes')).toHaveLength(2);
  });
  it('a second external refresh supersedes the collecting round without reusing its pending counterpart', async () => {
    const hook = setup(); const before = await ready(hook); const pending = deferred(); let incoming = 1;
    mockFetch.mockImplementation((input, init) => {
      if (urlOf(input, init).pathname === '/incomes' && ++incoming === 2) return pending.promise;
      return normalTransport(input, init);
    });
    await act(async () => { await hook.store.dispatch(expenseApi.endpoints.getExpenses.initiate(params(), { forceRefetch: true, subscribe: false })); });
    await waitFor(() => expect(financialCalls('/incomes')).toHaveLength(2));
    await act(async () => { await hook.store.dispatch(expenseApi.endpoints.getExpenses.initiate(params(), { forceRefetch: true, subscribe: false })); });
    expect(hook.read().status).toBe('fetching');
    await act(async () => { pending.resolve(response(incomeResponse([income('superseded-income')]))); });
    const state = await ready(hook); expect(state.context.loadGeneration).not.toBe(before.context.loadGeneration);
    expect(JSON.stringify(state)).not.toContain('superseded-income');
    expect(financialCalls('/expenses')).toHaveLength(3); expect(financialCalls('/incomes')).toHaveLength(3);
  });
  it('a transport failure blocks the whole review without logout or an automatic retry', async () => {
    mockFetch.mockImplementation((input, init) => urlOf(input, init).pathname === '/incomes'
      ? Promise.reject(new Error('Synthetic private network diagnostic')) : normalTransport(input, init));
    const hook = setup(); await waitFor(() => expect(hook.read()).toMatchObject({ status: 'error', error: { code: 'request_failed', dataset: 'incomes' } }));
    expect(JSON.stringify(hook.read())).not.toMatch(/private|synthetic|Bearer|Authorization/);
    expect(localStorage.getItem('token')).toBe(tokenA); expect(removes).not.toHaveBeenCalled(); expect(financialCalls()).toHaveLength(2);
  });
  it('verified-owner revalidation closes ready and requires fresh financial responses after recovery', async () => {
    const hook = setup(); const before = await ready(hook); const pending = deferred();
    mockFetch.mockImplementation((input, init) => urlOf(input, init).pathname === '/users/me' ? pending.promise : normalTransport(input, init));
    act(() => { hook.store.dispatch(userApi.endpoints.getMe.initiate(undefined, { forceRefetch: true, subscribe: false })); });
    await waitFor(() => expect(hook.read()).toEqual({ status: 'blocked', reason: 'verifying' }));
    await act(async () => { pending.resolve(response(profile('a'))); }); const after = await ready(hook);
    expect(after.context.sessionGeneration).toBe(before.context.sessionGeneration);
    expect(after.context.loadGeneration).not.toBe(before.context.loadGeneration); expect(financialCalls()).toHaveLength(4);
  });
  it('owner A -> B -> A and same-owner new login always receive fresh isolated contexts', async () => {
    const hook = setup(); const generations = [(await ready(hook)).context.loadGeneration];
    for (const [token, id] of [[tokenB, 'synthetic-b'], [tokenA, 'synthetic-a'], [tokenA, 'synthetic-a']]) {
      hook.frames.length = 0; await login(hook.store, token); const state = await ready(hook); generations.push(state.context.loadGeneration);
      expect(state.context.userId).toBe(id);
      for (const frame of hook.frames) if (frame.state.status === 'ready') {
        expect(frame.state.context.userId).toBe(id); expect(frame.state.context.sessionGeneration).toBe(frame.generation);
      }
    }
    expect(new Set(generations).size).toBe(4); expect(financialCalls()).toHaveLength(8);
  });
  it('observed cross-tab logout hides snapshots immediately and clears private cache without writes', async () => {
    const hook = setup(); await ready(hook); hook.frames.length = 0;
    act(() => { nativeRemove.call(localStorage, 'token'); window.dispatchEvent(new StorageEvent('storage', { key: 'token', storageArea: localStorage })); });
    await waitFor(() => expect(hook.read()).toEqual({ status: 'blocked', reason: 'unauthenticated' }));
    expect(hook.frames.every((frame) => frame.state.status !== 'ready')).toBe(true);
    expect(Object.keys(hook.store.getState().api.queries)).toHaveLength(0); expect(writes).not.toHaveBeenCalled(); expect(removes).not.toHaveBeenCalled();
  });
  it.each([200, 401, 403])('late old-session financial result %s cannot expose A or invalidate verified B', async (status) => {
    const oldE = deferred(); const oldI = deferred();
    mockFetch.mockImplementation((input, init) => ownerOf(input, init) === 'a' && urlOf(input, init).pathname !== '/users/me'
      ? urlOf(input, init).pathname === '/expenses' ? oldE.promise : oldI.promise : normalTransport(input, init));
    const hook = setup(); await waitFor(() => expect(financialCalls()).toHaveLength(2)); const running = uncooperative(hook.store);
    await login(hook.store, tokenB); await ready(hook); hook.frames.length = 0;
    await act(async () => { oldE.resolve(response(expenseResponse([expense('old-a-financial')]), status));
      oldI.resolve(response(incomeResponse([income('old-a-financial')]), status)); await Promise.all(running); });
    const state = await ready(hook); expect(state.context.userId).toBe('synthetic-b'); expect(JSON.stringify(state)).not.toContain('old-a-financial');
    expect(localStorage.getItem('token')).toBe(tokenB); expect(removes).not.toHaveBeenCalled();
  });
});
