import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { baseApi } from 'shared/api/baseApi';
import { expense, income, expenseResponse, incomeResponse } from 'features/FinancialAnalytics/model/tests/fixtures';
import AnalyticsPage from '../AnalyticsPage';

const mockFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

// Adapted from the legacy page tests. Keep the real analytics hook, validators,
// calculations, endpoints and RTK Query cache; replace only network transport.
jest.mock('shared/api/baseApi', () => {
  const { createApi, fetchBaseQuery } = jest.requireActual<typeof import('@reduxjs/toolkit/query/react')>('@reduxjs/toolkit/query/react');
  const query = fetchBaseQuery({ baseUrl: 'https://analytics.invalid',
    fetchFn: (...args: Parameters<typeof fetch>) => mockFetch(...args) });
  return { baseApi: createApi({
    reducerPath: 'analyticsPageTestApi',
    // Node Request and JSDOM AbortSignal are incompatible; only the mocked
    // transport omits the signal. No application URL or credentials are read.
    baseQuery: (args: string | import('@reduxjs/toolkit/query').FetchArgs, api, options) =>
      query({ ...(typeof args === 'string' ? { url: args } : args), signal: undefined }, api, options),
    tagTypes: ['Expense', 'Income', 'Balance'], endpoints: () => ({}),
  }) };
});
// Inspect chart inputs independently of SVG layout. Actual MUI charts are also
// exercised by AnalyticsResults.test.tsx.
jest.mock('@mui/x-charts/BarChart', () => ({ BarChart: jest.fn(() => <div role="img" aria-label="График категорий расходов" />) }));
jest.mock('@mui/x-charts/LineChart', () => ({ LineChart: jest.fn(() => <div role="img" aria-label="Месячная динамика расходов" />) }));

const theme = createTheme({ components: { MuiButtonBase: { defaultProps: { disableRipple: true } } } });
const makeStore = () => configureStore({
  reducer: { [baseApi.reducerPath]: baseApi.reducer },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
});
const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const urlOf = (input: RequestInfo | URL, init?: RequestInit) => new URL(new Request(input, init).url);
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const ready = () => waitFor(() => expect(screen.getByText('Записанные поступления')).toBeInTheDocument());
const summary = (label: string) => within(screen.getByText(label).parentElement!);
const deferred = () => {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
};
const lineProps = () => {
  const calls = jest.mocked(LineChart).mock.calls;
  return calls[calls.length - 1][0];
};
const barProps = () => {
  const calls = jest.mocked(BarChart).mock.calls;
  return calls[calls.length - 1][0];
};

describe('read-only AnalyticsPage with mocked RTK Query transport', () => {
  const stores: ReturnType<typeof makeStore>[] = [];
  let consoleError: jest.SpyInstance;
  const setup = () => {
    const store = makeStore();
    stores.push(store);
    render(<Provider store={store}><ThemeProvider theme={theme}><AnalyticsPage /></ThemeProvider></Provider>);
    return store;
  };
  const mockBodies = (expenses: unknown, incomes: unknown = incomeResponse()) =>
    mockFetch.mockImplementation(async (input, init) => response(urlOf(input, init).pathname === '/expenses' ? expenses : incomes));

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2024-02-29T23:30:00Z'));
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, 'error');
    mockFetch.mockReset();
    mockBodies(expenseResponse());
  });
  afterEach(() => {
    cleanup();
    act(() => stores.splice(0).forEach((store) => store.dispatch(baseApi.util.resetApiState())));
    jest.useRealTimers();
    try { expect(consoleError).not.toHaveBeenCalled(); } finally { consoleError.mockRestore(); }
  });

  it('requests a complete current UTC month and distinguishes genuine empty data', async () => {
    setup();
    await ready();
    expect(screen.getByRole('heading', { level: 1, name: 'Финансовая аналитика' })).toBeInTheDocument();
    expect(screen.getByText('За выбранный период операций нет.')).toBeInTheDocument();
    for (const label of ['Записанные поступления', 'Записанные расходы', 'Разность поступлений и расходов']) {
      expect(summary(label).getByText('0,00 ₽')).toBeInTheDocument();
    }
    expect(screen.getByText(/2024-02-01 — 2024-02-29/)).toHaveTextContent('UTC');
    expect(screen.getByText(/постоянный часовой пояс/)).toHaveTextContent('ещё не утверждён');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    for (const [input, init] of mockFetch.mock.calls) {
      expect(Object.fromEntries(urlOf(input, init).searchParams)).toEqual({
        startDate: '2024-02-01T00:00:00.000Z', endDate: '2024-02-29T23:59:59.999Z', noPagination: 'true',
      });
    }
    expect(lineProps().xAxis?.[0].data).toEqual(['2024-02']);
    expect(lineProps().series[0].data).toEqual([0]);
  });

  it('shows exact totals, operation counts, percentages and loans without double counting', async () => {
    mockBodies(expenseResponse([expense('e1', 0.1), expense('e2', 0.2, 'Выдача займа')]),
      incomeResponse([income('i', 1, 'Возврат займа')]));
    setup();
    await ready();
    expect(summary('Записанные поступления').getByText('1,00 ₽')).toBeInTheDocument();
    expect(summary('Записанные расходы').getByText('0,30 ₽')).toBeInTheDocument();
    expect(summary('Разность поступлений и расходов').getByText('0,70 ₽')).toBeInTheDocument();
    expect(summary('Количество записей доходов').getByText('1')).toBeInTheDocument();
    expect(summary('Количество записей расходов').getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/В суммы уже входят выдача займа/)).toHaveTextContent('повторно они не прибавляются');
    const table = within(screen.getByRole('table', { name: 'Расходные операции по категориям' }));
    const loanRow = within(table.getByRole('rowheader', { name: 'Выдача займа' }).parentElement!);
    expect(loanRow.getByText('0,20 ₽')).toBeInTheDocument();
    expect(loanRow.getByText('66,67%')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'График категорий расходов' })).toBeInTheDocument();
    expect(barProps().series[0].data).toEqual([20, 10]);
    const formatter = barProps().series[0].valueFormatter;
    expect(formatter?.(20, { dataIndex: 0 })).toBe('0,20 ₽');
    const categoryAmountAxis = barProps().xAxis?.[0];
    const dynamicsAmountAxis = lineProps().yAxis?.[0];
    if (categoryAmountAxis?.scaleType !== 'linear' || dynamicsAmountAxis?.scaleType !== 'linear') {
      throw new Error('Monetary chart axes must use the configured linear scale');
    }
    expect(categoryAmountAxis.valueFormatter?.(20, { location: 'legend' })).toBe('0,20 ₽');
    expect(dynamicsAmountAxis.valueFormatter?.(30, { location: 'legend' })).toBe('0,30 ₽');
    expect(lineProps().series[0].showMark).toBe(true);
    expect(lineProps().series[0].data).toEqual([30]);
  });

  it('displays a negative difference without rounding', async () => {
    mockBodies(expenseResponse([expense('e', 1.01)]), incomeResponse([income('i', 0.3)]));
    setup(); await ready();
    expect(summary('Разность поступлений и расходов').getByText('-0,71 ₽')).toBeInTheDocument();
  });

  it('keeps every category row and full long names while limiting the chart to twelve', async () => {
    const longName = 'Очень длинное название категории без сокращения в таблице';
    mockBodies(expenseResponse(Array.from({ length: 14 }, (_, i) => expense(`e${i}`, i + 1, i === 0 ? longName : `Категория ${i}`))));
    setup(); await ready();
    const table = within(screen.getByRole('table', { name: 'Расходные операции по категориям' }));
    expect(table.getAllByRole('row')).toHaveLength(15);
    expect(table.getByRole('rowheader', { name: longName })).toBeInTheDocument();
    expect(barProps().series[0].data).toHaveLength(12);
    expect(barProps().yAxis?.[0].data).not.toContain(longName);
    expect(screen.getByText(/12 крупнейших категорий/)).toHaveTextContent('таблица содержит все категории');
  });

  it('supports previous/current/selected month, quarter/year and calendar navigation', async () => {
    setup(); await ready();
    click('Предыдущий месяц'); await ready();
    expect(screen.getByText(/2024-01-01 — 2024-01-31/)).toBeInTheDocument();
    click('Текущий месяц'); await ready();
    change('Месяц', '12'); change('Год', '2023'); await ready();
    expect(screen.getByText(/2023-12-01 — 2023-12-31/)).toBeInTheDocument();
    change('Период', 'quarter'); await ready();
    expect(screen.getByText(/2023-10-01 — 2023-12-31/)).toBeInTheDocument();
    click('Следующий календарный период'); await ready();
    expect(screen.getByText(/2024-01-01 — 2024-03-31/)).toBeInTheDocument();
    change('Квартал', '2'); await ready();
    expect(screen.getByText(/2024-04-01 — 2024-06-30/)).toBeInTheDocument();
    change('Период', 'year'); await ready();
    expect(screen.getByText(/2024-01-01 — 2024-12-31/)).toBeInTheDocument();
    click('Предыдущий календарный период'); await ready();
    expect(screen.getByText(/2023-01-01 — 2023-12-31/)).toBeInTheDocument();
  });

  it('validates custom input, retains it for correction, hides totals and skips requests', async () => {
    setup(); await ready();
    change('Период', 'custom'); await ready();
    const count = mockFetch.mock.calls.length;
    change('Начальная дата', '2024-03-01');
    expect(screen.getByRole('alert')).toHaveTextContent('не должна быть позже');
    expect(screen.getByLabelText('Начальная дата')).toHaveValue('2024-03-01');
    expect(screen.getByLabelText('Конечная дата')).toHaveValue('2024-02-29');
    expect(screen.queryByText('Записанные поступления')).not.toBeInTheDocument();
    await act(async () => { jest.advanceTimersByTime(100); });
    expect(mockFetch).toHaveBeenCalledTimes(count);
    change('Начальная дата', '');
    expect(screen.getByRole('alert')).toHaveTextContent('Укажите корректные даты');
    expect(mockFetch).toHaveBeenCalledTimes(count);
    change('Конечная дата', '2024-03-31');
    change('Начальная дата', '2024-03-01'); await ready();
    expect(screen.getByText(/2024-03-01 — 2024-03-31/)).toBeInTheDocument();
  });

  it('uses monthly dynamics across years, including zero months, for short custom ranges too', async () => {
    setup(); await ready();
    change('Период', 'custom');
    change('Начальная дата', '');
    change('Конечная дата', '2024-02-29');
    mockBodies(expenseResponse([expense('e1', 1, 'Еда', '2023-12-31'), expense('e2', 2, 'Еда', '2024-02-01')]));
    change('Начальная дата', '2023-12-31'); await ready();
    expect(lineProps().xAxis?.[0].data).toEqual(['2023-12', '2024-01', '2024-02']);
    expect(lineProps().series[0].data).toEqual([100, 0, 200]);
    expect(screen.getByRole('heading', { name: 'Месячная динамика расходов' })).toBeInTheDocument();
  });

  it.each(['month', 'quarter', 'year'])('handles calendar domain boundaries for %s without an arbitrary 2020 minimum', async (kind) => {
    setup(); await ready();
    change('Месяц', '1'); change('Период', kind); change('Год', '1'); await ready();
    expect(screen.getByText(/0001-01-01 —/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Предыдущий календарный период' })).toBeDisabled();
    change('Год', '9999');
    if (kind === 'month') change('Месяц', '12');
    if (kind === 'quarter') change('Квартал', '4');
    await ready();
    expect(screen.getByText(/— 9999-12-31/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Следующий календарный период' })).toBeDisabled();
    const count = mockFetch.mock.calls.length;
    change('Год', '10000');
    expect(screen.getByRole('alert')).toHaveTextContent('год от 1 до 9999');
    expect(screen.queryByText('Записанные расходы')).not.toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(count);
  });

  it('announces initial loading without partial totals', async () => {
    const expensePending = deferred(); const incomePending = deferred();
    mockFetch.mockImplementation((input, init) => urlOf(input, init).pathname === '/expenses' ? expensePending.promise : incomePending.promise);
    setup();
    expect(screen.getByRole('status')).toHaveTextContent('Загрузка операций периода');
    expect(screen.getByRole('progressbar', { name: 'Загрузка финансовой аналитики' })).toBeInTheDocument();
    expect(screen.queryByText('Записанные расходы')).not.toBeInTheDocument();
    await act(async () => expensePending.resolve(response(expenseResponse())));
    expect(screen.queryByText('Записанные расходы')).not.toBeInTheDocument();
    await act(async () => incomePending.resolve(response(incomeResponse())));
    await ready();
  });

  it('hides cached totals while refetching', async () => {
    mockBodies(expenseResponse([expense('e', 12.34)]));
    const store = setup(); await ready();
    const pending = deferred();
    mockFetch.mockImplementation(() => pending.promise);
    act(() => { store.dispatch(baseApi.util.invalidateTags(['Expense'])); });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Обновление'));
    expect(screen.queryByText('12,34 ₽')).not.toBeInTheDocument();
    expect(screen.queryByText('Записанные расходы')).not.toBeInTheDocument();
    await act(async () => pending.resolve(response(expenseResponse([expense('e', 20)]))));
    await ready();
    expect(summary('Записанные расходы').getByText('20,00 ₽')).toBeInTheDocument();
  });

  it('never displays old-period totals while waiting for both responses of a new period', async () => {
    mockBodies(expenseResponse([expense('old', 99.99)]));
    setup(); await ready();
    const expensePending = deferred(); const incomePending = deferred();
    mockFetch.mockImplementation((input, init) => urlOf(input, init).pathname === '/expenses' ? expensePending.promise : incomePending.promise);
    change('Месяц', '3');
    expect(screen.queryByText('99,99 ₽')).not.toBeInTheDocument();
    expect(screen.queryByText('Записанные расходы')).not.toBeInTheDocument();
    await act(async () => expensePending.resolve(response(expenseResponse([expense('new', 2, 'Еда', '2024-03-10')]))));
    expect(screen.queryByText('Записанные расходы')).not.toBeInTheDocument();
    await act(async () => incomePending.resolve(response(incomeResponse([income('new-i', 5, 'Salary', '2024-03-10')]))));
    await ready();
    expect(summary('Разность поступлений и расходов').getByText('3,00 ₽')).toBeInTheDocument();
    expect(screen.queryByText('99,99 ₽')).not.toBeInTheDocument();
  });

  it('ignores late responses from an abandoned period', async () => {
    const oldExpense = deferred(); const oldIncome = deferred();
    mockFetch.mockImplementation((input, init) => urlOf(input, init).pathname === '/expenses' ? oldExpense.promise : oldIncome.promise);
    setup();
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    mockBodies(expenseResponse([expense('new', 2, 'Еда', '2024-03-10')]), incomeResponse([income('new-i', 5, 'Salary', '2024-03-10')]));
    change('Месяц', '3'); await ready();
    await act(async () => {
      oldExpense.resolve(response(expenseResponse([expense('old', 99.99)])));
      oldIncome.resolve(response(incomeResponse([income('old-i', 999)])));
    });
    expect(summary('Разность поступлений и расходов').getByText('3,00 ₽')).toBeInTheDocument();
    expect(screen.queryByText('99,99 ₽')).not.toBeInTheDocument();
    expect(screen.getByText(/2024-03-01 — 2024-03-31/)).toBeInTheDocument();
  });

  it.each(['expenses', 'incomes'])('shows %s API failure instead of zero totals', async (side) => {
    mockFetch.mockImplementation(async (input, init) => urlOf(input, init).pathname === `/${side}`
      ? new Response('', { status: 503 }) : response(side === 'expenses' ? incomeResponse() : expenseResponse()));
    setup();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить'));
    expect(screen.queryByText('Записанные расходы')).not.toBeInTheDocument();
    expect(screen.queryByText('0,00 ₽')).not.toBeInTheDocument();
  });

  it.each([
    ['invalid response', null, 'некорректный ответ'],
    ['invalid metadata', expenseResponse([], { page: 2 }), 'полноту ответа'],
    ['incomplete response', expenseResponse([], { total: 1 }), 'неполный список'],
    ['invalid date', expenseResponse([expense('e', 1, 'Еда', '2024-02-30')]), 'некорректная дата'],
    ['outside period', expenseResponse([expense('e', 1, 'Еда', '2024-03-01')]), 'вне выбранного периода'],
    ['invalid amount', expenseResponse([expense('e', -1)]), 'некорректная денежная сумма'],
    ['unsupported precision', expenseResponse([expense('e', 1.005)]), 'неподдерживаемой точностью'],
    ['overflow', expenseResponse(Array.from({ length: 20 }, (_, i) => expense(`e${i}`, 1e13))), 'безопасный диапазон'],
  ])('reports %s without exposing records or replacing failed totals with zero', async (_name, body, message) => {
    mockBodies(body); setup();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(message));
    expect(screen.getByRole('alert')).toHaveTextContent('Итоги периода не рассчитаны');
    expect(screen.queryByText('Записанные расходы')).not.toBeInTheDocument();
    expect(screen.queryByText('0,00 ₽')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).not.toHaveTextContent('Synthetic');
  });

  it('allows keyboard period controls and performs only credential-free GET requests', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    setup(); await ready();
    act(() => { screen.getByRole('button', { name: 'Предыдущий месяц' }).focus(); });
    await user.keyboard('{Enter}'); await ready();
    expect(screen.getByText(/2024-01-01 — 2024-01-31/)).toBeInTheDocument();
    change('Период', 'year'); await ready();
    expect(screen.getByLabelText('Год')).toBeInTheDocument();
    for (const [input, init] of mockFetch.mock.calls) {
      const request = new Request(input, init);
      expect(request.method).toBe('GET');
      expect(request.body).toBeNull();
      expect(request.headers.has('Authorization')).toBe(false);
      expect(['/expenses', '/incomes']).toContain(new URL(request.url).pathname);
    }
  });
});
