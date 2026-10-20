import { Profiler } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { baseApi } from 'shared/api/baseApi';
import { completeSessionTransition, getSessionSnapshot } from 'shared/api/sessionBoundary';
import rootReducer from 'app/providers/store/rootReducer';
import { UserProvider } from 'entities/User/ui/UserProvider';
import { userApi } from 'entities/User/api/userApi';
import { completeLogin } from 'features/Authorization/model/authThunks';
import { expenseResponse, incomeResponse } from 'features/FinancialAnalytics/model/tests/fixtures';
import AnalyticsPage from 'pages/AnalyticsPage/ui/AnalyticsPage';
import { recurrenceFixture } from '../../model/tests/fixtures';
import { RecurrenceSection } from '../RecurrenceSection';

const mockFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
jest.mock('features/Authorization', () => ({
  authorizationReducer: jest.requireActual('../../../../features/Authorization/model/authorizationSlice').reducer,
  setAuthenticated: jest.requireActual('../../../../features/Authorization/model/authorizationSlice').setAuthenticated,
}));
jest.mock('entities/User', () => ({ userReducer: jest.requireActual('../../../../entities/User/model/userSlice').reducer }));
jest.mock('entities/Income', () => ({ incomeReducer: jest.requireActual('../../../../entities/Income/model/incomeSlice').reducer }));
jest.mock('entities/Expense', () => ({ expenseReducer: jest.requireActual('../../../../entities/Expense/model/expenseSlice').reducer }));
jest.mock('entities/IncomeSource', () => ({ incomeSourceReducer: jest.requireActual('../../../../entities/IncomeSource/model/sourceSlice').incomeSourceReducer }));
jest.mock('widgets/Modals/AddIncomeModal', () => ({ addIncomeModalReducer: jest.requireActual('../../../../widgets/Modals/AddIncomeModal/model/addIncomeModalSlice').addIncomeModalReducer }));
jest.mock('widgets/Modals/AddExpenseModal', () => ({ addExpenseModalReducer: jest.requireActual('../../../../widgets/Modals/AddExpenseModal/model/addExpenseModalSlice').addExpenseModalReducer }));
jest.mock('widgets/Modals/EditIncomeModal', () => ({ editIncomeModalReducer: jest.requireActual('../../../../widgets/Modals/EditIncomeModal/model/editIncomeModalSlice').editIncomeModalReducer }));
jest.mock('widgets/Modals/EditExpenseModal', () => ({ editExpenseModalReducer: jest.requireActual('../../../../widgets/Modals/EditExpenseModal/model/editExpenseModalSlice').editExpenseModalReducer }));
jest.mock('@mui/x-charts/BarChart', () => ({ BarChart: () => <div role="img" aria-label="Synthetic category chart" /> }));
jest.mock('@mui/x-charts/LineChart', () => ({ LineChart: () => <div role="img" aria-label="Synthetic monthly chart" /> }));
jest.mock('shared/api/baseApi', () => {
  const { createApi, fetchBaseQuery } = jest.requireActual<typeof import('@reduxjs/toolkit/query/react')>('@reduxjs/toolkit/query/react');
  const { withSessionBoundary } = jest.requireActual<typeof import('../../../../shared/api/sessionBaseQuery')>('../../../../shared/api/sessionBaseQuery');
  const http = fetchBaseQuery({ baseUrl: 'https://recurrence.invalid', fetchFn: (...args: Parameters<typeof fetch>) => mockFetch(...args) });
  return { baseApi: createApi({ reducerPath: 'api', endpoints: () => ({}),
    // Only adapt JSDOM/Node's incompatible AbortSignal at the fake transport.
    // Keep the real credential/generation/result guard around every request.
    baseQuery: withSessionBoundary((args, api, options) => http({ ...(typeof args === 'string' ? { url: args } : args), signal: undefined }, api, options)),
    tagTypes: ['Expense', 'Income', 'User', 'Balance', 'Source', 'ExpenseCategory', 'Recipients', 'ExpenseTitles'],
  }) };
});

const tokenA = 'synthetic-recurrence-a', tokenB = 'synthetic-recurrence-b';
const nativeSet = Storage.prototype.setItem;
const theme = createTheme({ components: { MuiButtonBase: { defaultProps: { disableRipple: true } } } });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const requestOf = (input: RequestInfo | URL, init?: RequestInit) => input instanceof Request && !init ? input : new Request(input, init);
const urlOf = (input: RequestInfo | URL, init?: RequestInit) => new URL(requestOf(input, init).url);
const profile = (owner: string) => ({ _id: `fictional-owner-${owner}`, email: `fictional-${owner}@example.invalid` });
const ownerOf = (input: RequestInfo | URL, init?: RequestInit) => requestOf(input, init).headers.get('Authorization') === `Bearer ${tokenB}` ? 'B' : 'A';
const bodyFor = (input: RequestInfo | URL, init?: RequestInit, label = ownerOf(input, init)) => {
  const url = urlOf(input, init);
  if (url.pathname === '/users/me') return profile(ownerOf(input, init));
  if (url.pathname === '/expenses') return expenseResponse();
  if (url.pathname === '/incomes') return incomeResponse();
  if (url.pathname !== '/analytics/recurrence') throw new Error('Unexpected mocked endpoint');
  return recurrenceFixture({ startMonth: url.searchParams.get('startMonth')!, endMonthExclusive: url.searchParams.get('endMonthExclusive')! }, label);
};
const transport = async (input: RequestInfo | URL, init?: RequestInit) => response(bodyFor(input, init));
const pending = () => {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>(done => { resolve = done; }); return { promise, resolve };
};
const makeStore = () => configureStore({ reducer: rootReducer, middleware: defaults => defaults().concat(baseApi.middleware) });
type TestStore = ReturnType<typeof makeStore>;
const calls = () => mockFetch.mock.calls.filter(([input, init]) => urlOf(input, init).pathname === '/analytics/recurrence');
const choose = (months: string) => fireEvent.change(screen.getByRole('combobox', { name: 'Период повторяемости (UTC)' }), { target: { value: months } });
const ready = (owner = 'A') => screen.findByRole('heading', { name: `Fictional category ${owner}`, level: 4 });
const recurrence = () => within(screen.getByRole('region', { name: 'Повторяемость операций' }));
const login = async (store: TestStore, token: string) => {
  let completion!: Promise<number | null>;
  act(() => { completion = store.dispatch(completeLogin(token, getSessionSnapshot().generation)); });
  await act(async () => { await completion; });
};

describe('recurrence UI with real RTK/session boundary and synthetic transport', () => {
  const stores: TestStore[] = [];
  let network: jest.SpyInstance, log: jest.SpyInstance, error: jest.SpyInstance, writes: jest.SpyInstance;
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2025-04-15T12:00:00Z'));
    localStorage.clear(); sessionStorage.clear(); mockFetch.mockReset(); mockFetch.mockImplementation(transport);
    network = jest.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('Real network forbidden'); });
    log = jest.spyOn(console, 'log'); error = jest.spyOn(console, 'error'); writes = jest.spyOn(Storage.prototype, 'setItem');
  });
  afterEach(() => {
    cleanup(); completeSessionTransition(getSessionSnapshot().generation);
    act(() => stores.splice(0).forEach(store => store.dispatch(baseApi.util.resetApiState())));
    try {
      expect(network).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled();
      expect(writes.mock.calls.every(([key]) => key === 'token')).toBe(true);
      expect(sessionStorage.length).toBe(0);
      for (const [input, init] of mockFetch.mock.calls) {
        expect(requestOf(input, init).method).toBe('GET');
        expect(['/users/me', '/analytics/recurrence', '/expenses', '/incomes']).toContain(urlOf(input, init).pathname);
      }
    } finally { jest.restoreAllMocks(); jest.useRealTimers(); }
  });
  const setup = (token: string | null = tokenA, page = false) => {
    if (token) nativeSet.call(localStorage, 'token', token);
    const store = makeStore(); stores.push(store); const frames: string[] = [];
    render(<Provider store={store}><ThemeProvider theme={theme}><MemoryRouter><UserProvider>
      <Profiler id="recurrence" onRender={() => frames.push(document.body.textContent ?? '')}>
        {page ? <AnalyticsPage /> : <RecurrenceSection />}
      </Profiler>
    </UserProvider></MemoryRouter></ThemeProvider></Provider>);
    return { store, frames };
  };

  it('missing credentials issues no requests and shows no observations', () => {
    setup(null); expect(screen.getByText('Войдите, чтобы просмотреть наблюдения.')).toBeInTheDocument();
    choose('12'); expect(mockFetch).not.toHaveBeenCalled();
  });
  it('waits for verified /me before the recurrence GET and has a genuine loading state', async () => {
    const me = pending(), report = pending();
    mockFetch.mockImplementation((input, init) => urlOf(input, init).pathname === '/users/me' ? me.promise : report.promise);
    setup(); await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1)); expect(calls()).toHaveLength(0);
    expect(screen.getByText(/Проверка пользователя/)).toBeInTheDocument();
    await act(async () => { me.resolve(response(profile('A'))); });
    await waitFor(() => expect(calls()).toHaveLength(1));
    expect(screen.getByRole('status')).toHaveTextContent('Загрузка наблюдений');
    await act(async () => { report.resolve(response(recurrenceFixture())); }); await ready();
  });
  it.each([null, { email: 'fictional@example.invalid' }, { _id: 'invalid owner' }])('invalid owner proof fails closed (%j)', async payload => {
    mockFetch.mockResolvedValue(response(payload)); setup();
    await screen.findByText('Не удалось подтвердить пользователя для наблюдений.'); expect(calls()).toHaveLength(0);
  });
  it.each([401, 403])('invalid credential /me %i never starts recurrence', async status => {
    mockFetch.mockResolvedValue(response({ message: 'fictional denial' }, status)); setup();
    await screen.findByText('Войдите, чтобы просмотреть наблюдения.'); expect(calls()).toHaveLength(0);
  });
  it('renders distinct evidence and exact read-only query parameters with accessible labels', async () => {
    setup(); await ready(); expect(calls()).toHaveLength(1);
    const [input, init] = calls()[0];
    expect(Object.fromEntries(urlOf(input, init).searchParams)).toEqual({ startMonth: '2025-01', endMonthExclusive: '2025-04' });
    expect(requestOf(input, init).headers.get('Authorization')).toBe(`Bearer ${tokenA}`);
    expect(requestOf(input, init).body).toBeNull();
    for (const title of ['Категории расходов', 'Похожие расходные операции', 'Источники поступлений']) {
      expect(screen.getByRole('region', { name: title })).toBeInTheDocument();
    }
    const category = within(screen.getByRole('region', { name: 'Категории расходов' }));
    expect(category.getByText('Записанных операций').nextElementSibling).toHaveTextContent('4');
    expect(category.getByText('Активных месяцев').nextElementSibling).toHaveTextContent('3');
    expect(category.getByText('Самая длинная серия, мес.').nextElementSibling).toHaveTextContent('3');
    expect(screen.getByText(/не доказывает непрерывность/)).toBeInTheDocument();
    expect(screen.queryByText(/Подтверждено регулярно|Обязательный расход|Гарантированный доход|\d+%/)).not.toBeInTheDocument();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.tab(); expect(screen.getByRole('combobox')).toHaveFocus();
    await user.tab(); expect(document.activeElement?.tagName).toBe('SUMMARY');
    // JSDOM does not implement summary's native Enter default action. Check
    // its tab stop/click here; Chromium acceptance also exercises Enter.
    await user.click(document.activeElement!);
    expect(category.getByText(/Активные месяцы \(UTC\): 2025-01, 2025-02, 2025-03/)).toBeInTheDocument();
    expect(category.getByText(/Активные месяцы \(UTC\):/).closest('details')).toHaveAttribute('open');
  });
  it.each(['6', '12'])('selects %s completed months without changing the financial selector', async months => {
    setup(tokenA, true); await ready();
    const count = mockFetch.mock.calls.filter(([input, init]) => ['/expenses', '/incomes'].includes(urlOf(input, init).pathname)).length;
    choose(months); await waitFor(() => expect(calls()).toHaveLength(2)); await ready();
    const url = urlOf(...calls()[1]);
    expect(Object.fromEntries(url.searchParams)).toEqual({ startMonth: months === '6' ? '2024-10' : '2024-04', endMonthExclusive: '2025-04' });
    expect(screen.getByLabelText('Период')).toHaveValue('month');
    expect(mockFetch.mock.calls.filter(([input, init]) => ['/expenses', '/incomes'].includes(urlOf(input, init).pathname))).toHaveLength(count);
  });
  it('A/B/A and a same-owner fresh session never commit previous-owner responses', async () => {
    const { store, frames } = setup(); await ready();
    const first = getSessionSnapshot().generation;
    for (const [token, owner, old] of [[tokenB, 'B', 'A'], [tokenA, 'A', 'B'], [tokenA, 'A', 'B']]) {
      frames.length = 0; await login(store, token); await ready(owner);
      expect(frames.every(frame => !frame.includes(`Fictional category ${old}`))).toBe(true);
    }
    expect(getSessionSnapshot().generation).toBe(first + 3); expect(calls()).toHaveLength(4);
  });
  it('same owner/new credential starts fresh rather than publishing its previous cache', async () => {
    const { store, frames } = setup(); await ready();
    const fresh = pending(); mockFetch.mockImplementation((input, init) => urlOf(input, init).pathname === '/users/me'
      ? transport(input, init) : fresh.promise);
    frames.length = 0; await login(store, 'synthetic-recurrence-a-renewed');
    await waitFor(() => expect(calls()).toHaveLength(2));
    expect(screen.queryByRole('heading', { name: 'Fictional category A' })).not.toBeInTheDocument();
    expect(frames.every(frame => !frame.includes('Fictional category A'))).toBe(true);
    await act(async () => { fresh.resolve(response(recurrenceFixture(undefined, 'Renewed'))); }); await ready('Renewed');
  });
  it.each([200, 401, 503])('obsolete A completion %i cannot replace B, store A data or log out B', async status => {
    const old = pending(); mockFetch.mockImplementation((input, init) => urlOf(input, init).pathname === '/analytics/recurrence' && ownerOf(input, init) === 'A'
      ? old.promise : transport(input, init));
    const { store, frames } = setup(); await waitFor(() => expect(calls()).toHaveLength(1));
    store.dispatch(baseApi.util.getRunningQueriesThunk()).forEach(query => { query.abort = () => {}; });
    await login(store, tokenB); await ready('B'); frames.length = 0;
    await act(async () => { old.resolve(response(status === 200 ? recurrenceFixture(undefined, 'Obsolete') : { secret: 'fictional-obsolete-body' }, status)); });
    expect(localStorage.getItem('token')).toBe(tokenB);
    expect(screen.queryByText(/Fictional category Obsolete/)).not.toBeInTheDocument();
    expect(JSON.stringify(store.getState())).not.toContain('fictional-obsolete-body');
    expect(JSON.stringify(store.getState())).not.toContain('Fictional category Obsolete');
    expect(frames.every(frame => !frame.includes('Obsolete'))).toBe(true);
  });
  it('notices an unobserved credential change before accepting an old completion', async () => {
    const old = pending(); mockFetch.mockImplementation((input, init) => urlOf(input, init).pathname === '/analytics/recurrence' && ownerOf(input, init) === 'A'
      ? old.promise : transport(input, init));
    setup(); await waitFor(() => expect(calls()).toHaveLength(1));
    await act(async () => { nativeSet.call(localStorage, 'token', tokenB); old.resolve(response(recurrenceFixture(undefined, 'Obsolete'))); });
    await ready('B'); expect(screen.queryByText(/Fictional category Obsolete/)).not.toBeInTheDocument();
  });
  it('period A/B/A with in-flight requests requires a fresh A request', async () => {
    const requests: Array<{ deferred: ReturnType<typeof pending>; body: unknown }> = [];
    mockFetch.mockImplementation((input, init) => {
      if (urlOf(input, init).pathname === '/users/me') return transport(input, init);
      const deferred = pending(); requests.push({ deferred, body: bodyFor(input, init, requests.length === 0 ? 'Retired' : 'Fresh') }); return deferred.promise;
    });
    setup(); await waitFor(() => expect(requests).toHaveLength(1)); choose('6');
    await waitFor(() => expect(requests).toHaveLength(2)); choose('3');
    await waitFor(() => expect(requests).toHaveLength(3));
    await act(async () => { requests[0].deferred.resolve(response(requests[0].body)); requests[1].deferred.resolve(response(requests[1].body)); });
    expect(screen.queryByText(/Fictional category Retired|Fictional category Fresh/)).not.toBeInTheDocument();
    await act(async () => { requests[2].deferred.resolve(response(requests[2].body)); }); await ready('Fresh');
  });
  it.each(['Expense', 'Income'] as const)('%s invalidation hides old data during background refetch and after an error', async tag => {
    const { store } = setup(); await ready(); const update = pending(); mockFetch.mockReturnValue(update.promise);
    act(() => { store.dispatch(baseApi.util.invalidateTags([tag])); });
    await waitFor(() => expect(calls()).toHaveLength(2));
    expect(screen.getByRole('status')).toHaveTextContent('Обновление наблюдений');
    expect(screen.queryByRole('heading', { name: 'Fictional category A' })).not.toBeInTheDocument();
    await act(async () => { update.resolve(response({ secret: 'fictional-error-body' }, 503)); });
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить наблюдения');
    expect(screen.queryByRole('heading', { name: 'Fictional category A' })).not.toBeInTheDocument();
    expect(JSON.stringify(store.getState())).not.toContain('fictional-error-body');
    mockFetch.mockImplementation(transport); fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку наблюдений' })); await ready();
  });
  it.each(['missing coverage', 'invalid group', 'stale window'])('rejects %s without partial evidence or an empty-state claim', async kind => {
    mockFetch.mockImplementation(async (input, init) => {
      if (urlOf(input, init).pathname !== '/analytics/recurrence') return transport(input, init);
      const dto = recurrenceFixture();
      if (kind === 'missing coverage') Reflect.deleteProperty(dto, 'coverage');
      else if (kind === 'invalid group') dto.observations[2].group.dataset = 'loans';
      else dto.window.startMonth = '2024-12';
      return response(dto);
    });
    setup(); expect(await screen.findByRole('alert')).toHaveTextContent('не соответствует формату');
    expect(screen.queryByText(/Fictional category|группы наблюдений не найдены/)).not.toBeInTheDocument();
  });
  it('413 is an oversized-history error while the existing analytics remains usable', async () => {
    mockFetch.mockImplementation(async (input, init) => urlOf(input, init).pathname === '/analytics/recurrence'
      ? response({ message: 'fictional limit' }, 413) : transport(input, init));
    setup(tokenA, true); expect(await recurrence().findByRole('alert')).toHaveTextContent('1000 операций');
    expect(screen.getByText('Записанные поступления')).toBeInTheDocument();
    expect(screen.getByText('Записанные расходы')).toBeInTheDocument();
    expect(recurrence().queryByText(/группы наблюдений не найдены/)).not.toBeInTheDocument();
  });
  it.each([401, 403])('current recurrence %i remains an access error, not empty data', async status => {
    mockFetch.mockImplementation(async (input, init) => urlOf(input, init).pathname === '/analytics/recurrence'
      ? response({ secret: 'fictional-denial' }, status) : transport(input, init));
    setup(); expect(await screen.findByRole('alert')).toHaveTextContent('Нет доступа');
    expect(recurrence().queryByText(/группы наблюдений не найдены/)).not.toBeInTheDocument();
  });
  it.each([200, 413])('non-JSON response preserves HTTP %i without exposing its body', async status => {
    mockFetch.mockImplementation(async (input, init) => urlOf(input, init).pathname === '/analytics/recurrence'
      ? new Response('<html>fictional-private-error-body</html>', { status, headers: { 'Content-Type': 'text/html' } }) : transport(input, init));
    const { store } = setup();
    expect(await screen.findByRole('alert')).toHaveTextContent(status === 413 ? '1000 операций' : 'не соответствует формату');
    expect(JSON.stringify(store.getState())).not.toContain('fictional-private-error-body');
  });
  it('genuine empty evidence retains the bookkeeping disclaimer', async () => {
    mockFetch.mockImplementation(async (input, init) => urlOf(input, init).pathname === '/analytics/recurrence'
      ? response({ ...recurrenceFixture(), observations: [] }) : transport(input, init));
    setup(); expect(await screen.findByText(/Это не доказывает отсутствие операций/)).toBeInTheDocument();
    expect(screen.getByText(/не доказывает непрерывность/)).toBeInTheDocument();
  });
  it('a current /me identity change closes the section instead of relabeling cached observations', async () => {
    const { store } = setup(); await ready(); mockFetch.mockResolvedValue(response(profile('B')));
    await act(async () => { await store.dispatch(userApi.endpoints.getMe.initiate(undefined, { forceRefetch: true, subscribe: false })); });
    await screen.findByText('Не удалось подтвердить пользователя для наблюдений.');
    expect(screen.queryByRole('heading', { name: 'Fictional category A' })).not.toBeInTheDocument(); expect(calls()).toHaveLength(1);
  });
  it('same-owner /me verification hides old evidence and starts a fresh recurrence scope', async () => {
    const { store, frames } = setup(); await ready(); const me = pending(), fresh = pending();
    mockFetch.mockImplementation((input, init) => urlOf(input, init).pathname === '/users/me' ? me.promise : fresh.promise);
    frames.length = 0;
    let verification: PromiseLike<unknown> | undefined;
    act(() => { verification = store.dispatch(userApi.endpoints.getMe.initiate(undefined, { forceRefetch: true, subscribe: false })); });
    // RTK batches store notifications. Hold /me unresolved and observe the
    // committed verifying state rather than assuming synchronous notification.
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Fictional category A' })).not.toBeInTheDocument());
    await act(async () => { me.resolve(response(profile('A'))); await verification; });
    await waitFor(() => expect(calls()).toHaveLength(2));
    expect(frames.every(frame => !frame.includes('Fictional category A'))).toBe(true);
    await act(async () => { fresh.resolve(response(recurrenceFixture(undefined, 'Reverified'))); }); await ready('Reverified');
  });
  it('bounds rendered cards without discarding additional validated groups', async () => {
    const dto = recurrenceFixture();
    const observations = Array.from({ length: 25 }, (_, i) => ({ ...dto.observations[0],
      group: { ...dto.observations[0].group, identity: { provenance: 'label_only', value: `Fictional category ${i}` } },
      operationCount: 1, activeMonthCount: 1, activeMonths: ['2025-01'], intervalsInMonths: [], longestConsecutiveMonths: 1,
    }));
    mockFetch.mockImplementation(async (input, init) => urlOf(input, init).pathname === '/users/me' ? transport(input, init)
      : response({ ...dto, observations }));
    setup(); await screen.findByRole('heading', { name: 'Fictional category 0', level: 4 });
    const category = within(screen.getByRole('region', { name: 'Категории расходов' }));
    expect(category.getAllByRole('listitem')).toHaveLength(20);
    fireEvent.click(category.getByRole('button', { name: /Показать ещё группы/ }));
    expect(category.getAllByRole('listitem')).toHaveLength(25);
  });
  it('advances completed UTC months on an open page at the month boundary', async () => {
    jest.setSystemTime(new Date('2025-01-31T23:59:59.000Z')); setup(); await ready();
    await act(async () => { jest.advanceTimersByTime(1100); });
    await waitFor(() => expect(calls()).toHaveLength(2));
    expect(Object.fromEntries(urlOf(...calls()[1]).searchParams)).toEqual({ startMonth: '2024-11', endMonthExclusive: '2025-02' });
  });
});
