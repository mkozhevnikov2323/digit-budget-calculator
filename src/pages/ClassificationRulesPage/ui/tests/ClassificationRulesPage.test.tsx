import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router';
import AppRouter from 'app/providers/router/AppRouter';
import { baseApi } from 'shared/api/baseApi';
import { getSessionSnapshot, transitionSession, completeSessionTransition } from 'shared/api/sessionBoundary';
import { VerifiedOwnerContext } from 'entities/User/model/useVerifiedOwner';
import type { VerifiedOwnerState } from 'entities/User/model/verifiedOwner';
import { classificationRulesApi } from 'features/ClassificationRules/api/rulesApi';

const mockFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
jest.mock('shared/api/baseApi', () => {
  const { createApi, fetchBaseQuery } = jest.requireActual<typeof import('@reduxjs/toolkit/query/react')>('@reduxjs/toolkit/query/react');
  const { withSessionBoundary } = jest.requireActual<typeof import('shared/api/sessionBaseQuery')>('shared/api/sessionBaseQuery');
  const http = fetchBaseQuery({ baseUrl: 'https://rules.invalid', fetchFn: (...args: Parameters<typeof fetch>) => mockFetch(...args) });
  return { baseApi: createApi({ reducerPath: 'rulesTest', endpoints: () => ({}),
    baseQuery: withSessionBoundary((args, api, options) => http({ ...(typeof args === 'string' ? { url: args } : args), signal: undefined }, api, options)),
  }) };
});
jest.mock('pages/MainPage', () => ({ MainPage: () => <div>Public entry</div> }));
jest.mock('pages/IncomePage', () => ({ IncomePage: () => null }));
jest.mock('pages/ExpensesPage', () => ({ ExpensesPage: () => null }));
jest.mock('pages/BalancePage', () => ({ BalancePage: () => null }));
jest.mock('pages/NotFoundPage', () => ({ NotFoundPage: () => null }));
jest.mock('pages/LoansPage', () => ({ LoansPage: () => null }));

const a = 'a'.repeat(24), b = 'b'.repeat(24);
const expense = (extra = {}) => ({ _id: '1'.repeat(24), owner: a, dataset: 'expenses', enabled: true,
  category: 'Продукты', economicRole: 'ordinary_expense', layer: 'everyday',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...extra });
const income = () => ({ ...expense(), _id: '2'.repeat(24), dataset: 'incomes', category: undefined,
  source: 'Зарплата', economicRole: 'ordinary_income', layer: null, enabled: false });
const response = (rules: unknown[], status = 200) => new Response(JSON.stringify({ rules }), { status, headers: { 'Content-Type': 'application/json' } });
const verified = (userId = a): VerifiedOwnerState => ({ status: 'verified', owner: { userId, sessionGeneration: getSessionSnapshot().generation } });
const stores: ReturnType<typeof makeStore>[] = [];
const makeStore = () => configureStore({ reducer: { [baseApi.reducerPath]: baseApi.reducer }, middleware: get => get().concat(baseApi.middleware) });
let networkGuard: jest.SpyInstance;
beforeEach(() => {
  localStorage.setItem('token', 'synthetic-token-a'); mockFetch.mockReset();
  mockFetch.mockImplementation(async () => response([expense(), income()]));
  networkGuard = jest.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('Real network forbidden'); });
});
afterEach(() => {
  cleanup(); act(() => stores.splice(0).forEach(store => store.dispatch(baseApi.util.resetApiState())));
  completeSessionTransition(getSessionSnapshot().generation); localStorage.clear();
  expect(networkGuard).not.toHaveBeenCalled(); jest.restoreAllMocks();
});
const show = (path = '/profile/classification-rules', initial = verified()) => {
  const store = makeStore(); stores.push(store);
  const tree = (state: VerifiedOwnerState) => <Provider store={store}><VerifiedOwnerContext.Provider value={state}>
    <MemoryRouter initialEntries={[path]}><AppRouter /></MemoryRouter>
  </VerifiedOwnerContext.Provider></Provider>;
  const view = render(tree(initial));
  return { ...view, store, owner: (state: VerifiedOwnerState) => view.rerender(tree(state)) };
};

it('navigates from profile to settings and back using real protected routes', async () => {
  show('/profile');
  const link = await screen.findByRole('link', { name: 'Настройки автоматической классификации' });
  expect(link).toHaveAttribute('href', '/profile/classification-rules'); fireEvent.click(link);
  await screen.findByRole('table', { name: 'Правила расходов' });
  fireEvent.click(screen.getByRole('link', { name: 'Вернуться в профиль' }));
  expect(await screen.findByText('Профиль пользователя')).toBeInTheDocument();
});
it('renders expenses/incomes, optional title, Russian labels and activity using JWT GET only', async () => {
  mockFetch.mockImplementation(async () => response([expense(), expense({ _id: '3'.repeat(24), category: 'Аптеки', title: 'Витамины', layer: 'irregular' }), income()]));
  show(); const expenses = await screen.findByRole('table', { name: 'Правила расходов' });
  expect(within(expenses).getByText('Продукты')).toBeInTheDocument(); expect(within(expenses).getByText('Все наименования')).toBeInTheDocument();
  expect(within(expenses).getByText('Витамины')).toBeInTheDocument(); expect(within(expenses).getByText('Повседневные расходы')).toBeInTheDocument();
  expect(within(expenses).getByText('Нерегулярные расходы')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Доходы' }));
  const incomes = screen.getByRole('table', { name: 'Правила доходов' });
  expect(within(incomes).getByText('Зарплата')).toBeInTheDocument(); expect(within(incomes).getByText('Обычное поступление')).toBeInTheDocument();
  expect(within(incomes).getByText('Выключено')).toBeInTheDocument(); expect(screen.queryByText('Продукты')).not.toBeInTheDocument();
  expect(mockFetch).toHaveBeenCalledTimes(1);
  const [input, init] = mockFetch.mock.calls[0], request = new Request(input, init);
  expect(request.url).toBe('https://rules.invalid/classification-rules'); expect(request.method).toBe('GET');
  expect(request.headers.get('Authorization')).toBe('Bearer synthetic-token-a'); expect(screen.queryByRole('button', { name: /Создать|Изменить|Удалить/ })).not.toBeInTheDocument();
});
it('shows loading and empty lists independently for both tabs', async () => {
  let resolve!: (r: Response) => void; mockFetch.mockImplementation(() => new Promise(done => { resolve = done; }));
  show(); expect(await screen.findByText('Загрузка правил…')).toBeInTheDocument();
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
  await act(async () => { resolve(response([])); });
  expect(await screen.findByText('Нет сохранённых правил расходов.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Доходы' })); expect(screen.getByText('Нет сохранённых правил доходов.')).toBeInTheDocument();
});
it('shows API errors without cached rows and supports a working retry', async () => {
  mockFetch.mockResolvedValueOnce(response([], 503)); show();
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить правила классификации.');
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку' }));
  expect(await screen.findByText('Продукты')).toBeInTheDocument();
});
it('redirects unauthenticated direct entry without requesting rules', async () => {
  localStorage.removeItem('token'); show();
  expect(await screen.findByText('Public entry')).toBeInTheDocument(); expect(mockFetch).not.toHaveBeenCalled();
});
it('waits for verified owner without redirecting or revealing previous rows', async () => {
  const view = show(); expect(await screen.findByText('Продукты')).toBeInTheDocument();
  view.owner({ status: 'verifying' }); expect(screen.getByText('Проверка пользователя…')).toBeInTheDocument();
  expect(screen.queryByText('Продукты')).not.toBeInTheDocument(); expect(screen.queryByText('Public entry')).not.toBeInTheDocument();
  view.owner({ status: 'verification_error', reason: 'request_failed' }); expect(screen.getByRole('alert')).toHaveTextContent('Не удалось подтвердить пользователя.');
  expect(mockFetch).toHaveBeenCalledTimes(1);
});
it('discards previous-user rows and a late response after a real session transition', async () => {
  const view = show(); expect(await screen.findByText('Продукты')).toBeInTheDocument();
  let resolve!: (r: Response) => void; mockFetch.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const scope = { userId: a, sessionGeneration: getSessionSnapshot().generation };
  let pending!: PromiseLike<unknown>;
  act(() => { pending = view.store.dispatch(classificationRulesApi.endpoints.getClassificationRules.initiate(scope, { forceRefetch: true, subscribe: false })); });
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  let transition!: Promise<number | null>;
  act(() => { transition = transitionSession(() => localStorage.setItem('token', 'synthetic-token-b')); });
  expect(screen.queryByText('Продукты')).not.toBeInTheDocument();
  mockFetch.mockImplementation(async () => response([expense({ owner: b, category: 'Правило другого пользователя' })]));
  await act(async () => { completeSessionTransition(getSessionSnapshot().generation); await transition; view.owner(verified(b)); });
  expect(await screen.findByText('Правило другого пользователя')).toBeInTheDocument();
  await act(async () => { resolve(response([expense({ category: 'Поздний ответ прошлого пользователя' })])); await pending; });
  expect(screen.queryByText('Поздний ответ прошлого пользователя')).not.toBeInTheDocument(); expect(screen.queryByText('Продукты')).not.toBeInTheDocument();
});
it.each([expense({ owner: b }), expense({ economicRole: 'loan_issuance', layer: null }), expense({ layer: 'unknown' })])('rejects foreign-owner or invalid v2 response without rendering rows', async rule => {
  mockFetch.mockImplementation(async () => response([rule])); show();
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить правила классификации.'); expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
