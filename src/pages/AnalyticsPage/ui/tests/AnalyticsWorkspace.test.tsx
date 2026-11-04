import { MemoryRouter } from 'react-router';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { createTheme, ThemeProvider } from '@mui/material';
import { AnalyticsDestination } from '../AnalyticsDestination';
import {
  analyticsUIReducer,
  hydratePreferences,
  loadPreferences,
  preferencesMiddleware,
} from 'features/AnalyticsState/model/slice';
import { VerifiedOwnerContext } from 'entities/User/model/useVerifiedOwner';
import { getSessionSnapshot } from 'shared/api/sessionBoundary';
import type { AnalyticsPageKey } from 'features/AnalyticsState/model/slice';
import { baseApi } from 'shared/api/baseApi';
const mockFetch = jest.fn();
jest.mock('shared/api/baseApi', () => {
  const { createApi, fetchBaseQuery } = jest.requireActual(
    '@reduxjs/toolkit/query/react',
  );
  const query = fetchBaseQuery({
    baseUrl: 'https://synthetic.invalid',
    fetchFn: (...args: unknown[]) => mockFetch(...args),
  });
  return {
    baseApi: createApi({
      reducerPath: 'workspaceApi',
      baseQuery: (
        args: string | import('@reduxjs/toolkit/query').FetchArgs,
        api: Parameters<typeof query>[1],
        options: Parameters<typeof query>[2],
      ) =>
        query(
          {
            ...(typeof args === 'string' ? { url: args } : args),
            signal: undefined,
          },
          api,
          options,
        ),
      tagTypes: ['Expense', 'Income'],
      endpoints: () => ({}),
    }),
  };
});
jest.mock('@mui/x-charts/LineChart', () => ({
  LineChart: () => <div>Multi-month chart</div>,
}));
jest.mock('@mui/x-charts/BarChart', () => ({
  BarChart: () => <div>Category chart</div>,
}));
const makeStore = () =>
  configureStore({
    reducer: {
      analyticsUI: analyticsUIReducer,
      [baseApi.reducerPath]: baseApi.reducer,
    },
    middleware: (g) => g().concat(baseApi.middleware, preferencesMiddleware),
  });
const stores: ReturnType<typeof makeStore>[] = [];
const theme = createTheme();
const Tree = ({
  page,
  store,
  owner = 'a'.repeat(24),
}: {
  page: AnalyticsPageKey;
  store: ReturnType<typeof makeStore>;
  owner?: string;
}) => (
  <Provider store={store}>
    <VerifiedOwnerContext.Provider
      value={{
        status: 'verified',
        owner: {
          userId: owner,
          sessionGeneration: getSessionSnapshot().generation,
        },
      }}
    >
      <MemoryRouter><ThemeProvider theme={theme}>
        <AnalyticsDestination
          key={page}
          page={page}
        />
      </ThemeProvider></MemoryRouter>
    </VerifiedOwnerContext.Provider>
  </Provider>
);
beforeEach(() => {
  localStorage.clear();
  mockFetch.mockReset();
  mockFetch.mockImplementation(async (input: RequestInfo) => {
    const url = new URL(new Request(input).url),
      dataset = url.pathname.includes('expenses') ? 'expenses' : 'incomes';
    return new Response(
      JSON.stringify({ [dataset]: [], total: 0, page: 1, limit: 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  });
});
afterEach(() => {
  cleanup();
  act(() =>
    stores.splice(0).forEach((s) => s.dispatch(baseApi.util.resetApiState())),
  );
  localStorage.clear();
});
it('reuses fulfilled raw history cache and restores independent per-page periods after navigation and reload', async () => {
  const chosenMonth = new Date().getUTCMonth() === 8 ? '10' : '9';
  const store = makeStore();
  stores.push(store);
  const view = render(
    <Tree
      page="overview"
      store={store}
    />,
  );
  await screen.findByText('Записанные расходы');
  expect(mockFetch).toHaveBeenCalledTimes(2);
  view.rerender(
    <Tree
      page="categories"
      store={store}
    />,
  );
  await screen.findByText('В этом периоде расходных записей нет.');
  expect(mockFetch).toHaveBeenCalledTimes(2);
  fireEvent.change(screen.getByLabelText('Месяц'), { target: { value: chosenMonth } });
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(4));
  view.rerender(
    <Tree
      page="overview"
      store={store}
    />,
  );
  await screen.findByText('Записанные расходы');
  expect(screen.getByLabelText('Месяц')).not.toHaveValue(chosenMonth);
  expect(mockFetch).toHaveBeenCalledTimes(4);
  view.rerender(
    <Tree
      page="categories"
      store={store}
    />,
  );
  expect(screen.getByLabelText('Месяц')).toHaveValue(chosenMonth);
  expect(mockFetch).toHaveBeenCalledTimes(4);
  const next = makeStore();
  stores.push(next);
  next.dispatch(hydratePreferences(loadPreferences()));
  view.unmount();
  render(
    <Tree
      page="categories"
      store={next}
    />,
  );
  expect(screen.getByLabelText('Месяц')).toHaveValue(chosenMonth);
});
it('retains budget input, manual protection and open state on navigation, but never confirmations or private input after reload/owner change', async () => {
  const store = makeStore();
  stores.push(store);
  const view = render(
    <Tree
      page="planning"
      store={store}
    />,
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Открыть локальный план' }),
  );
  await screen.findByLabelText('Повседневные расходы месяц 1');
  fireEvent.change(screen.getByLabelText('Повседневные расходы месяц 1'), {
    target: { value: '123.456-invalid' },
  });
  fireEvent.change(screen.getByLabelText('Новая годовая сумма Резерв'), {
    target: { value: '77.15' },
  });
  view.rerender(
    <Tree
      page="categories"
      store={store}
    />,
  );
  view.rerender(
    <Tree
      page="planning"
      store={store}
    />,
  );
  expect(screen.getByLabelText('Повседневные расходы месяц 1')).toHaveValue(
    '123.456-invalid',
  );
  expect(screen.getByLabelText('Новая годовая сумма Резерв')).toHaveValue(
    '77.15',
  );
  expect(screen.getByText(/Защищённые ручные слои:/)).toHaveTextContent(
    'Повседневные расходы',
  );
  expect(JSON.stringify(loadPreferences())).not.toMatch(/123.456|77.15/);
  view.rerender(
    <Tree
      page="planning"
      store={store}
      owner={'b'.repeat(24)}
    />,
  );
  expect(
    screen.queryByLabelText('Повседневные расходы месяц 1'),
  ).not.toBeInTheDocument();
  const next = makeStore();
  stores.push(next);
  next.dispatch(hydratePreferences(loadPreferences()));
  view.unmount();
  render(
    <Tree
      page="planning"
      store={next}
    />,
  );
  expect(
    screen.queryByLabelText('Повседневные расходы месяц 1'),
  ).not.toBeInTheDocument();
});
