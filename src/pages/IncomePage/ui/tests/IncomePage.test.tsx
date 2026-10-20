import { configureStore } from '@reduxjs/toolkit';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { Provider } from 'react-redux';
import { baseApi } from 'shared/api/baseApi';
import { incomeApi, useGetIncomesQuery } from '../../../../entities/Income/api/incomeApi';
import { reducer as incomeReducer, setMonth, setYear } from '../../../../entities/Income/model/incomeSlice';
import { addIncomeModalReducer } from '../../../../widgets/Modals/AddIncomeModal/model/addIncomeModalSlice';
import type { IncomeResponse, IncomeSchema } from '../../../../entities/Income/model/types';
import IncomePage from '../IncomePage';

// Real endpoint definitions, cache, invalidation, store, page, table, modal and
// forms. Only the transport and unrelated all-time charts are substituted.
const mockTransport = jest.fn<ReturnType<BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>>, [string | FetchArgs]>();
jest.mock('shared/api/baseApi', () => {
  const { createApi } = jest.requireActual<typeof import('@reduxjs/toolkit/query/react')>('@reduxjs/toolkit/query/react');
  return { baseApi: createApi({ reducerPath: 'api', endpoints: () => ({}),
    baseQuery: (args: string | FetchArgs) => mockTransport(args),
    tagTypes: ['Income', 'Balance', 'Source'],
  }) };
});
jest.mock('entities/Income', () => ({
  ...jest.requireActual('../../../../entities/Income/api/incomeApi'),
  ...jest.requireActual('../../../../entities/Income/model/selectors'),
  ...jest.requireActual('../../../../entities/Income/model/incomeSlice'),
  ...jest.requireActual('../../../../entities/Income/hooks/useSyncIncomeWithStore'),
}), { virtual: true });
jest.mock('entities/IncomeSource', () => jest.requireActual('../../../../entities/IncomeSource/api/sourceApi'), { virtual: true });
// Register the same virtual aliases as the existing form/modal suites. Without
// this, Jest's shared resolver can cache real alias IDs before their virtual mocks.
// These re-exports still exercise the actual fields and modal in this suite.
jest.mock('shared/ui/DateField', () => jest.requireActual('../../../../shared/ui/DateField/ui/DateField'), { virtual: true });
jest.mock('shared/ui/AmountField', () => jest.requireActual('../../../../shared/ui/AmountField/ui/AmountField'), { virtual: true });
jest.mock('features/AddIncomeSource', () => jest.requireActual('../../../../features/AddIncomeSource/ui/IncomeSourceField'), { virtual: true });
jest.mock('features/AddIncome', () => jest.requireActual('../../../../features/AddIncome/ui/AddIncomeForm'), { virtual: true });
jest.mock('shared/ui/Modal', () => jest.requireActual('../../../../shared/ui/Modal/ui/Modal'), { virtual: true });
jest.mock('widgets/IncomeCharts', () => ({ IncomeCharts: () => <div>Income charts</div> }));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
type Result = { data: unknown } | { error: FetchBaseQueryError };
const row = (comment: string): IncomeSchema => ({ _id: 'synthetic-income', date: '2026-09-20', amount: 123.45, source: 'Synthetic source', comment });
const payload = (incomes: IncomeSchema[]): IncomeResponse => ({ incomes, total: incomes.length, page: 1, limit: 20 });
const failure: Result = { error: { status: 503, data: { message: 'Synthetic unavailable' } } };
const methodOf = (args: string | FetchArgs) => typeof args === 'string' ? 'GET' : args.method ?? 'GET';
const urlOf = (args: string | FetchArgs) => typeof args === 'string' ? args : args.url;
const makeStore = () => configureStore({
  reducer: { income: incomeReducer, incomeModal: addIncomeModalReducer, [baseApi.reducerPath]: baseApi.reducer },
  middleware: (defaults) => defaults().concat(baseApi.middleware),
});
// Observe a committed query transition independently of the page under test.
// RTK batches notifications; awaiting the mutation alone can miss its pending render.
const QueryStatus = () => {
  const { isFetching } = useGetIncomesQuery({ year: 2026, month: 9, page: 1, limit: 20 });
  return <output data-testid="query-status">{isFetching ? 'fetching' : 'idle'}</output>;
};
const theme = createTheme({ components: { MuiButtonBase: { defaultProps: { disableRipple: true } } } });

describe('IncomePage cache refresh and active financial draft', () => {
  const stores: ReturnType<typeof makeStore>[] = [];
  let networkGuard: jest.SpyInstance;
  beforeEach(() => {
    mockTransport.mockReset();
    networkGuard = jest.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('Real network forbidden'); });
    mockTransport.mockImplementation(async (args) => urlOf(args).startsWith('/sources')
      ? { data: [{ _id: 'synthetic-source', name: 'Synthetic source' }] }
      : { data: payload([row('Original row')]) });
  });
  afterEach(() => {
    cleanup();
    act(() => stores.splice(0).forEach((store) => store.dispatch(baseApi.util.resetApiState())));
    try { expect(networkGuard).not.toHaveBeenCalled(); } finally { jest.restoreAllMocks(); }
  });
  const mount = () => {
    const store = makeStore(); stores.push(store);
    store.dispatch(setYear(2026)); store.dispatch(setMonth(9));
    render(<Provider store={store}><ThemeProvider theme={theme}><QueryStatus /><IncomePage /></ThemeProvider></Provider>);
    return store;
  };
  const openDraft = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Добавить доход' }));
    const dialog = await screen.findByRole('dialog', { name: 'Добавление дохода' });
    const date = within(dialog).getByLabelText('Дата');
    fireEvent.change(date, { target: { value: '2026-09-20' } });
    fireEvent.change(within(dialog).getByLabelText(/^Сумма/), { target: { value: '123.45' } });
    fireEvent.change(within(dialog).getByRole('combobox', { name: /Источник дохода/ }), { target: { value: 'Synthetic source' } });
    fireEvent.change(within(dialog).getByLabelText('Комментарий'), { target: { value: 'Active draft' } });
    return { dialog, date, button: within(dialog).getByRole('button', { name: 'Добавить доход' }) };
  };
  const expectDraft = (date: HTMLElement) => {
    expect(screen.getByLabelText('Дата')).toBe(date);
    expect(date).toHaveValue('2026-09-20');
    expect(screen.getByLabelText('Комментарий')).toHaveValue('Active draft');
  };
  const calls = (method: string) => mockTransport.mock.calls.filter(([args]) => methodOf(args) === method);

  it('shows initial loading and allows a draft to survive the first query result', async () => {
    const pending = deferred<Result>();
    const transport = mockTransport.getMockImplementation()!;
    mockTransport.mockImplementation((args) => urlOf(args).startsWith('/incomes') ? pending.promise : transport(args));
    mount();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Таблица доходов')).not.toBeInTheDocument();
    const { date } = await openDraft();
    await act(async () => { pending.resolve({ data: payload([row('Initial row')]) }); });
    await screen.findByText('Initial row');
    expectDraft(date);
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('keeps the same modal/date during POST invalidation and renders the refreshed income once', async () => {
    mount(); await screen.findByText('Original row');
    const { dialog, date, button } = await openDraft();
    const mutation = deferred<Result>(); const refresh = deferred<Result>();
    mockTransport.mockImplementation((args) => methodOf(args) === 'POST' ? mutation.promise : refresh.promise);
    const form = button.closest('form')!;
    act(() => { fireEvent.submit(form); fireEvent.submit(form); fireEvent.click(button); });
    await waitFor(() => expect(calls('POST')).toHaveLength(1));
    expect(within(dialog).getByRole('button', { name: 'close' })).toBeDisabled();
    await act(async () => { mutation.resolve({ data: null }); });
    await waitFor(() => expect(calls('GET').filter(([args]) => urlOf(args).startsWith('/incomes'))).toHaveLength(2));
    expect(screen.getByRole('dialog', { name: 'Добавление дохода' })).toBe(dialog);
    expect(screen.getByLabelText('Дата')).toBe(date);
    expect(date).toHaveValue('2026-09-20');
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(screen.getByText('Original row')).toBeInTheDocument();
    await act(async () => { refresh.resolve({ data: payload([row('Saved row')]) }); });
    await screen.findByText('Saved row');
    expect(screen.queryByText('Original row')).not.toBeInTheDocument();
    expect(date).toHaveValue('2026-09-20');
    expect(screen.getByLabelText('Комментарий')).toHaveValue('');
    expect(calls('POST')).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole('button', { name: 'close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it.each(['PATCH', 'DELETE'] as const)('%s invalidates the real query without unmounting an active add draft', async (method) => {
    const store = mount(); await screen.findByText('Original row');
    const { date } = await openDraft();
    const refresh = deferred<Result>();
    mockTransport.mockImplementation((args) => methodOf(args) === method ? Promise.resolve({ data: null }) : refresh.promise);
    await act(async () => {
      if (method === 'PATCH') await store.dispatch(incomeApi.endpoints.updateIncome.initiate({ ...row('Updated row'), amount: 150 }));
      else await store.dispatch(incomeApi.endpoints.deleteIncome.initiate({ id: 'synthetic-income' }));
    });
    await waitFor(() => expect(screen.getByTestId('query-status')).toHaveTextContent('fetching'));
    expectDraft(date);
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    await act(async () => { refresh.resolve({ data: payload(method === 'PATCH' ? [row('Updated row')] : []) }); });
    await waitFor(() => expect(screen.queryByText('Original row')).not.toBeInTheDocument());
    if (method === 'PATCH') expect(screen.getByText('Updated row')).toBeInTheDocument();
    expectDraft(date);
    expect(calls(method)).toHaveLength(1);
    expect(calls('GET').filter(([args]) => urlOf(args).startsWith('/incomes'))).toHaveLength(2);
  });

  it('preserves failed input and uncertain-result/close guards even when invalidation refetch also fails', async () => {
    mount(); await screen.findByText('Original row');
    const { dialog, date, button } = await openDraft();
    const refresh = deferred<Result>();
    mockTransport.mockImplementation((args) => methodOf(args) === 'POST' ? Promise.resolve(failure) : refresh.promise);
    fireEvent.submit(button.closest('form')!);
    await screen.findByText(/Доход мог уже сохраниться/);
    expectDraft(date);
    expect(screen.getByLabelText(/^Сумма/)).toHaveValue('123.45');
    expect(button).toBeDisabled();
    await act(async () => { refresh.resolve(failure); });
    await screen.findByText('Ошибка при загрузке доходов');
    expectDraft(date);
    fireEvent.submit(button.closest('form')!);
    expect(calls('POST')).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole('button', { name: 'close' }));
    await screen.findByRole('dialog', { name: 'Закрыть результат сохранения дохода?' });
    expect(date).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Остаться' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Закрыть результат сохранения дохода?' })).not.toBeInTheDocument());
    expectDraft(date);
    fireEvent.click(screen.getByRole('button', { name: 'История проверена, продолжить ввод' }));
    expect(button).toBeEnabled();
    expect(calls('POST')).toHaveLength(1);
  });

  it('hides previous-period rows while the next period loads or fails, preserving the active draft', async () => {
    const store = mount(); await screen.findByText('Original row');
    const { date } = await openDraft();
    const next = deferred<Result>();
    mockTransport.mockImplementation(() => next.promise);
    act(() => { store.dispatch(setMonth(10)); });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Original row')).not.toBeInTheDocument();
    expectDraft(date);
    await act(async () => { next.resolve(failure); });
    await screen.findByText('Ошибка при загрузке доходов');
    expect(screen.queryByText('Original row')).not.toBeInTheDocument();
    expectDraft(date);
    // Returning to cached arguments may show their data, never the failed period's.
    act(() => { store.dispatch(setMonth(9)); });
    await screen.findByText('Original row');
    expectDraft(date);
    expect(calls('GET').filter(([args]) => urlOf(args).startsWith('/incomes'))).toHaveLength(2);
  });
});
