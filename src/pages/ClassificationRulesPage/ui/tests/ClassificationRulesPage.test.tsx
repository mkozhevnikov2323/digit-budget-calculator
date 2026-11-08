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
  return { baseApi: createApi({ reducerPath: 'rulesTest', tagTypes: ['ClassificationRule', 'ExpenseCategory', 'ExpenseTitles', 'Source'], endpoints: () => ({}),
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
  expect(request.headers.get('Authorization')).toBe('Bearer synthetic-token-a'); expect(screen.getByRole('button', { name: 'Редактировать правило Зарплата' })).toBeEnabled();
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

// Synthetic server state; real RTK/session guards, dialogs and form validation remain active.
const reply = (body: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const crudServer = (initial: Record<string, unknown>[] = [expense(), income()]) => {
  const state: { rules: Record<string, unknown>[]; writes: { method: string; body: Record<string, unknown> }[];
    onWrite?: (request: Request, body: Record<string, unknown>) => Promise<Response> | undefined } = { rules: initial, writes: [] };
  mockFetch.mockImplementation(async (input, init) => {
    const request = new Request(input, init), path = new URL(request.url).pathname;
    if (!path.startsWith('/classification-rules')) return reply([{ id: 'dict', name: 'Справочное значение' }]);
    const owner = request.headers.get('Authorization') === 'Bearer synthetic-token-b' ? b : a;
    if (request.method === 'GET') return response(state.rules.filter(rule => rule.owner === owner));
    const body: Record<string, unknown> = request.method === 'DELETE' ? {} : JSON.parse(await request.text());
    state.writes.push({ method: request.method, body });
    const custom = state.onWrite?.(request, body); if (custom) return custom;
    const normalized = Object.fromEntries(Object.entries(body).map(([key, value]) => [key,
      ['category', 'title', 'source'].includes(key) && typeof value === 'string' ? value.trim().toLowerCase() : value]));
    if (request.method === 'POST') {
      const rule = { ...expense(), ...normalized, _id: String(state.rules.length + 3).repeat(24), owner };
      if (normalized.dataset === 'incomes') delete (rule as Record<string, unknown>).category;
      state.rules.push(rule); return reply(rule, 201);
    }
    const index = state.rules.findIndex(rule => rule._id === path.split('/').pop() && rule.owner === owner);
    if (index < 0) return reply({ message: 'Правило не найдено.' }, 404);
    if (request.method === 'DELETE') { state.rules.splice(index, 1); return reply(null, 204); }
    const rule = { ...state.rules[index], ...normalized }; if (rule.title === null) delete rule.title;
    state.rules[index] = rule; return reply(rule);
  });
  return state;
};
const enterExpense = async (category = 'Новая категория') => {
  fireEvent.change(screen.getByRole('combobox', { name: /Категория/ }), { target: { value: category } });
  fireEvent.change(screen.getByRole('combobox', { name: /Группа расходов/ }), { target: { value: 'emergency' } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить правило' })).toBeEnabled());
};
const saveRule = () => fireEvent.click(screen.getByRole('button', { name: 'Сохранить правило' }));

it('validates and creates an expense once, reloading the confirmed list without owner metadata', async () => {
  const state = crudServer(); show(); await screen.findByText('Продукты');
  fireEvent.click(screen.getByRole('button', { name: 'Добавить правило' }));
  expect(screen.getByRole('button', { name: 'Сохранить правило' })).toBeDisabled();
  const groups = screen.getByRole('combobox', { name: /Группа расходов/ });
  expect(within(groups).getAllByRole('option').map(option => option.getAttribute('value'))).toEqual(['', 'everyday', 'irregular', 'emergency', 'major_goals', 'long_term_capital']);
  fireEvent.change(screen.getByRole('combobox', { name: /Категория/ }), { target: { value: '   ' } });
  fireEvent.change(groups, { target: { value: 'emergency' } });
  expect(state.writes).toHaveLength(0); expect(screen.getByRole('button', { name: 'Сохранить правило' })).toBeDisabled();
  await enterExpense(); saveRule(); saveRule();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await screen.findByText('новая категория')).toBeInTheDocument();
  expect(state.writes).toEqual([{ method: 'POST', body: { dataset: 'expenses', category: 'Новая категория', economicRole: 'ordinary_expense', layer: 'emergency', enabled: true } }]);
});
it('edits an expense, explicitly clears title and retains the saved enabled state', async () => {
  const state = crudServer([expense({ title: 'Хлеб', enabled: false })]); show(); await screen.findByText('Хлеб');
  fireEvent.click(screen.getByRole('button', { name: 'Редактировать правило Продукты · Хлеб' }));
  expect(screen.getByRole('combobox', { name: /Категория/ })).toHaveValue('Продукты');
  fireEvent.change(screen.getByRole('combobox', { name: /Наименование/ }), { target: { value: '' } });
  fireEvent.change(screen.getByRole('combobox', { name: /Группа расходов/ }), { target: { value: 'irregular' } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить правило' })).toBeEnabled()); saveRule();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await screen.findByText('Все наименования')).toBeInTheDocument(); expect(screen.getByText('Выключено')).toBeInTheDocument();
  expect(state.writes[0]).toEqual({ method: 'PATCH', body: { category: 'Продукты', title: null, economicRole: 'ordinary_expense', layer: 'irregular' } });
});
it('uses income dictionaries and accepts only the five v2 income roles', async () => {
  const state = crudServer(); show(); await screen.findByText('Продукты');
  fireEvent.click(screen.getByRole('tab', { name: 'Доходы' })); fireEvent.click(screen.getByRole('button', { name: 'Добавить правило' }));
  const roles = screen.getByRole('combobox', { name: /Экономический тип/ });
  expect(within(roles).getAllByRole('option').map(option => option.getAttribute('value'))).toEqual(['', 'ordinary_income', 'loan_repayment', 'refund', 'internal_transfer', 'capital_movement']);
  const source = screen.getByRole('combobox', { name: /Источник дохода/ }); fireEvent.mouseDown(source);
  fireEvent.change(source, { target: { value: 'Справ' } });
  fireEvent.click(await screen.findByRole('option', { name: 'Справочное значение' }));
  fireEvent.change(roles, { target: { value: 'refund' } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить правило' })).toBeEnabled()); saveRule();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await screen.findByText('справочное значение')).toBeInTheDocument();
  expect(state.writes[0]).toEqual({ method: 'POST', body: { dataset: 'incomes', source: 'Справочное значение', economicRole: 'refund', layer: null, enabled: true } });
});
it('keeps the previous activity until acknowledgement and removes a rule only after confirmation', async () => {
  const state = crudServer(); show(); await screen.findByText('Продукты');
  let resolve!: (r: Response) => void;
  state.onWrite = request => request.method === 'PATCH' ? new Promise(done => { resolve = done; }) : undefined;
  fireEvent.click(screen.getByRole('button', { name: 'Отключить правило Продукты' }));
  await waitFor(() => expect(state.writes).toHaveLength(1));
  expect(screen.getByText('Включено')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Отключить правило Продукты' })).toBeDisabled();
  state.rules[0] = { ...state.rules[0], enabled: false };
  await act(async () => { resolve(reply(state.rules[0])); });
  expect(await screen.findByRole('button', { name: 'Включить правило Продукты' })).toBeEnabled();
  state.onWrite = undefined;
  fireEvent.click(screen.getByRole('button', { name: 'Удалить правило Продукты' }));
  expect(state.writes).toHaveLength(1); fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); expect(screen.getByText('Продукты')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Удалить правило Продукты' })); fireEvent.click(screen.getByRole('button', { name: 'Удалить правило' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await screen.findByText('Нет сохранённых правил расходов.')).toBeInTheDocument();
  expect(state.writes.map(write => write.method)).toEqual(['PATCH', 'DELETE']);
});
it.each([400, 409, 503])('retains the form on definite server error %s and retries only after another click', async status => {
  const state = crudServer(); state.onWrite = () => Promise.resolve(reply({ message: 'Ошибка сервера правил', persistence: 'not_applied' }, status));
  show(); await screen.findByText('Продукты'); fireEvent.click(screen.getByRole('button', { name: 'Добавить правило' }));
  await enterExpense('Черновик'); saveRule();
  expect(await screen.findByRole('alert')).toHaveTextContent(String(status)); expect(screen.getByRole('combobox', { name: /Категория/ })).toHaveValue('Черновик');
  expect(state.writes).toHaveLength(1); expect(screen.getByRole('dialog')).toBeInTheDocument();
  state.onWrite = undefined; saveRule();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); expect(await screen.findByText('черновик')).toBeInTheDocument(); expect(state.writes).toHaveLength(2);
});
it.each(['unknown', 'unknown_400', 'network', 'invalid_response'])('blocks %s outcomes across remount and refreshes without repeating the write', async outcome => {
  const state = crudServer(); state.onWrite = () => outcome === 'network' ? Promise.reject(new Error('Synthetic connection loss'))
    : Promise.resolve(outcome.startsWith('unknown') ? reply({ message: 'Недоступно', persistence: 'unknown' }, outcome === 'unknown_400' ? 400 : 503) : reply(expense({ owner: b }), 201));
  const view = show(); await screen.findByText('Продукты'); fireEvent.click(screen.getByRole('button', { name: 'Добавить правило' }));
  await enterExpense(); saveRule();
  expect(await screen.findByRole('alert')).toHaveTextContent('Результат записи неизвестен');
  expect(screen.getByRole('button', { name: 'Сохранить правило' })).toBeDisabled(); expect(state.writes).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  view.owner({ status: 'verifying' }); view.owner(verified());
  await screen.findByRole('table', { name: 'Правила расходов' }); expect(screen.getByRole('button', { name: 'Добавить правило' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Обновить список без повторной записи' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Добавить правило' })).toBeEnabled()); expect(state.writes).toHaveLength(1);
});
it('ignores a late write from the previous user and preserves the new user draft', async () => {
  const state = crudServer([expense(), expense({ owner: b, _id: '4'.repeat(24), category: 'Правило B' })]);
  let resolve!: (r: Response) => void; state.onWrite = () => new Promise(done => { resolve = done; });
  const view = show(); await screen.findByText('Продукты'); fireEvent.click(screen.getByRole('button', { name: 'Отключить правило Продукты' }));
  await waitFor(() => expect(state.writes).toHaveLength(1));
  let transition!: Promise<number | null>; act(() => { transition = transitionSession(() => localStorage.setItem('token', 'synthetic-token-b')); });
  await act(async () => { completeSessionTransition(getSessionSnapshot().generation); await transition; view.owner(verified(b)); });
  expect(await screen.findByText('Правило B')).toBeInTheDocument(); expect(screen.queryByText('Продукты')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Добавить правило' })); await enterExpense('Черновик B');
  await act(async () => { resolve(reply(expense({ enabled: false }))); });
  expect(screen.getByRole('combobox', { name: /Категория/ })).toHaveValue('Черновик B');
  expect(screen.getByRole('button', { name: 'Сохранить правило' })).toBeEnabled(); expect(screen.queryByRole('alert')).not.toBeInTheDocument(); expect(state.writes).toHaveLength(1);
});

it('keeps the editor open when cancel races the asynchronous submit validation', async () => {
  const state = crudServer();
  state.onWrite = () => Promise.resolve(reply({ message: 'Проверьте поля', persistence: 'not_applied' }, 400));
  show(); await screen.findByText('Продукты');
  fireEvent.click(screen.getByRole('button', { name: 'Добавить правило' })); await enterExpense('Черновик');
  act(() => { saveRule(); fireEvent.click(screen.getByRole('button', { name: 'Отмена' })); });
  expect(await screen.findByRole('alert')).toHaveTextContent('400');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: /Категория/ })).toHaveValue('Черновик');
  expect(state.writes).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
