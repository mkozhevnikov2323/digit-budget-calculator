import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { VerifiedOwnerContext } from 'entities/User/model/useVerifiedOwner';
import {
  getSessionSnapshot,
  transitionSession,
  completeSessionTransition,
} from 'shared/api/sessionBoundary';
import { baseApi } from 'shared/api/baseApi';
import GroupsPage from '../ui/GroupsPage';
import GroupRulesPage from '../ui/RulesPage';
import Statistics from '../ui/Statistics';
import { OperationPanel } from '../ui/OperationPanel';
import Workspace from '../ui/Workspace';
import { BatchDialog } from '../ui/BatchDialog';
import { groupDecisionRequest } from '../api/decisionClient';
import { analyticsUIReducer } from 'features/AnalyticsState/model/slice';
import {
  catalog,
  end,
  group,
  owner,
  page,
  read,
  report,
  rule,
  start,
  wrap,
  approved,
  proposal,
} from './fixtures';
import type { Group, GroupRule } from '../model/contract';
import { operationFromRead } from '../model/contract';
jest.mock('shared/config/classificationGroups', () => ({
  classificationGroupsV3Enabled: true,
}));
jest.mock('../api/decisionClient', () => ({ groupDecisionRequest: jest.fn() }));
const mockTransport = jest.fn();
jest.mock('shared/api/baseApi', () => {
  const { createApi } = jest.requireActual<
    typeof import('@reduxjs/toolkit/query/react')
  >('@reduxjs/toolkit/query/react');
  return {
    apiBaseUrl: 'https://synthetic.invalid',
    baseApi: createApi({
      reducerPath: 'groupsUI',
      baseQuery: (r: unknown) => mockTransport(r),
      tagTypes: [
        'Expense',
        'Income',
        'ClassificationGroup',
        'ClassificationGroupRule',
        'ExpenseCategory',
        'ExpenseTitles',
        'Source',
      ],
      endpoints: () => ({}),
    }),
  };
});
const period = {
  firstDate: '2025-01-01',
  lastDate: '2025-01-31',
  startInclusive: start,
  endExclusive: end,
};
let groups: Group[],
  rules: GroupRule[],
  initialized: boolean,
  error: number | undefined;
const put = jest.mocked(groupDecisionRequest);
const setup = (ui: React.ReactNode) => {
  const store = configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      analyticsUI: analyticsUIReducer,
    },
    middleware: (g) => g().concat(baseApi.middleware),
  });
  const result = render(
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
        <MemoryRouter
          initialEntries={['/analytics/classification?dataset=expenses']}
        >
          {ui}
        </MemoryRouter>
      </VerifiedOwnerContext.Provider>
    </Provider>,
  );
  return { ...result, store };
};
beforeAll(() =>
  Object.defineProperty(crypto, 'randomUUID', {
    configurable: true,
    value: () => '10000000-0000-4000-8000-000000000001',
  }),
);
beforeEach(() => {
  groups = [group()];
  rules = [rule()];
  initialized = true;
  error = undefined;
  put.mockReset();
  mockTransport.mockReset().mockImplementation(async (request) => {
    const r = typeof request === 'string' ? { url: request } : request;
    if (r.method && r.method !== 'GET') {
      if (error)
        return {
          error: {
            status: error,
            data: {
              version: 'classification-groups-v3',
              error: { code: 'rejected' },
              persistence: error === 503 ? 'unknown' : 'not_applied',
            },
          },
        };
      if (r.url.endsWith('/initialize')) {
        initialized = true;
        return { data: wrap({ initialized: true }) };
      }
      if (r.url === '/classification-groups/report')
        return {
          data: wrap({
            ...report(),
            operations: r.body.includeOperations ? report().operations : [],
          }),
        };
      if (r.url === '/classification-groups/rules' && r.method === 'POST') {
        const row = rule({
          ...r.body,
          group: groups.find((g) => g.groupId === r.body.groupId)!,
          id: '3'.repeat(24),
          category: r.body.category?.trim().toLowerCase(),
          title: r.body.title?.trim().toLowerCase(),
          source: r.body.source?.trim().toLowerCase(),
        });
        if (row.dataset === 'expenses') delete row.source;
        else {
          delete row.category;
          delete row.title;
        }
        if (row.title === undefined) delete row.title;
        rules.push(row);
        return { data: wrap(row) };
      }
      if (r.url.includes('/rules/')) {
        const index = rules.findIndex((row) => r.url.endsWith(row.id));
        if (r.method === 'DELETE') {
          rules.splice(index, 1);
          return { data: wrap({ deleted: true }) };
        }
        const { expectedEtag: _, ...change } = r.body;
        rules[index] = {
          ...rules[index],
          ...change,
          revision: rules[index].revision + 1,
          etag: 'c'.repeat(64),
        };
        rules[index].diagnostic = rules[index].enabled ? 'ready' : 'disabled';
        return { data: wrap(rules[index]) };
      }
      if (r.url === '/classification-groups' && r.method === 'POST') {
        const row = group({
          ...r.body,
          groupId: 'custom:10000000-0000-4000-8000-000000000002',
        });
        groups.push(row);
        return { data: wrap(row) };
      }
      const index = groups.findIndex((g) =>
          decodeURIComponent(r.url).endsWith(g.groupId),
        ),
        g = groups[index];
      if (index >= 0) {
        const { expectedRevision: _, resetName, ...change } = r.body;
        groups[index] = {
          ...g,
          ...change,
          ...(r.method === 'DELETE' ? { status: 'archived' } : {}),
          ...(resetName
            ? {
                name: catalog().systemDefinitions.find(
                  (d) => d.groupId === g.groupId,
                )!.name,
              }
            : {}),
          revision: g.revision + 1,
        };
        return { data: wrap(groups[index]) };
      }
    }
    if (r.url.startsWith('/classification-groups?'))
      return {
        data: {
          ...page(groups),
          result: { ...catalog(groups), initialized, nextCursor: null },
        },
      };
    if (r.url === '/classification-groups/rules')
      return { data: wrap({ rules }) };
    if (r.url.startsWith('/classification-groups/operations/'))
      return { data: wrap(read()) };
    return { data: [] };
  });
});
afterEach(() => jest.clearAllMocks());
it('initializes only on explicit click; page navigation alone never writes', async () => {
  initialized = false;
  setup(<GroupsPage />);
  const button = await screen.findByRole('button', {
    name: 'Инициализировать каталог',
  });
  expect(mockTransport.mock.calls.some(([r]) => r.method === 'POST')).toBe(
    false,
  );
  fireEvent.click(button);
  await screen.findByRole('button', { name: 'Создать группу' });
  expect(
    mockTransport.mock.calls.filter(([r]) => r.url.endsWith('/initialize')),
  ).toHaveLength(1);
});
it('creates a group then renames/archives/restores it by stable ID, preserving confirmations', async () => {
  setup(<GroupsPage />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Создать группу' }),
  );
  fireEvent.change(screen.getByLabelText('Название группы'), {
    target: { value: 'Семья' },
  });
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Создать группу',
    }),
  );
  await screen.findByRole('region', { name: 'Группа Семья' });
  let region = screen.getByRole('region', { name: 'Группа Семья' });
  fireEvent.click(
    within(region).getByRole('button', { name: 'Переименовать' }),
  );
  fireEvent.change(screen.getByLabelText('Название группы'), {
    target: { value: 'Семья и дом' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить название' }));
  region = await screen.findByRole('region', { name: 'Группа Семья и дом' });
  fireEvent.click(within(region).getByRole('button', { name: 'Архивировать' }));
  expect(mockTransport.mock.calls.some(([r]) => r.method === 'DELETE')).toBe(
    false,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Архивировать группу' }));
  await screen.findByText('В архиве');
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  region = screen.getByRole('region', { name: 'Группа Семья и дом' });
  fireEvent.click(within(region).getByRole('button', { name: 'Восстановить' }));
  await waitFor(() =>
    expect(
      screen.getByRole('region', { name: 'Группа Семья и дом' }),
    ).toHaveTextContent('Включена'),
  );
  expect(groups.find((g) => g.name === 'Семья и дом')?.groupId).toBe(
    'custom:10000000-0000-4000-8000-000000000002',
  );
});
it('system groups can be renamed/reset/disabled, with no delete action', async () => {
  groups = [group({ groupId: 'system:expenses:everyday', origin: 'system' })];
  setup(<GroupsPage />);
  const region = await screen.findByRole('region', {
    name: 'Группа Автомобиль',
  });
  expect(
    within(region).queryByRole('button', { name: 'Архивировать' }),
  ).not.toBeInTheDocument();
  fireEvent.click(within(region).getByRole('button', { name: 'Отключить' }));
  await waitFor(() => expect(screen.getByText('Отключена')).toBeVisible());
  fireEvent.click(
    screen.getByRole('button', { name: 'Вернуть исходное название' }),
  );
  await screen.findByText('system:expenses:everyday');
});
it('duplicate/revision errors preserve form data; unknown error blocks a repeated write', async () => {
  setup(<GroupsPage />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Создать группу' }),
  );
  fireEvent.change(screen.getByLabelText('Название группы'), {
    target: { value: 'Автомобиль' },
  });
  error = 409;
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Создать группу',
    }),
  );
  await screen.findByText(/Конфликт, дубликат/);
  expect(screen.getByLabelText('Название группы')).toHaveValue('Автомобиль');
  error = 503;
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Создать группу',
    }),
  );
  await screen.findByText(/Результат записи неизвестен/);
  expect(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Создать группу',
    }),
  ).toBeDisabled();
});
it('v3 rules display legacy mappings and use groupId/expectedEtag; no automatic conversion', async () => {
  rules = [rule({ revision: 0 })];
  setup(<GroupRulesPage />);
  await screen.findByText(/Совместимое прежнее правило/);
  expect(mockTransport.mock.calls.some(([r]) => r.method === 'PATCH')).toBe(
    false,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Отключить' }));
  await screen.findByText('Правило отключено');
  const request = mockTransport.mock.calls.find(
    ([r]) => r.method === 'PATCH',
  )![0];
  expect(request.body).toEqual({
    expectedEtag: 'b'.repeat(64),
    enabled: false,
  });
  expect(request.url).toBe('/classification-groups/rules/' + rule().id);
});
it('creates expense and income rules with an active dynamic group selector', async () => {
  groups.push(
    group({
      dataset: 'incomes',
      name: 'Подработка',
      groupId: 'custom:10000000-0000-4000-8000-000000000003',
    }),
  );
  const user = userEvent.setup();
  setup(<GroupRulesPage />);
  await screen.findByText('Группа: Автомобиль');
  fireEvent.click(screen.getByRole('tab', { name: 'Доходы' }));
  fireEvent.click(screen.getByRole('button', { name: 'Добавить правило' }));
  await user.type(
    screen.getByRole('combobox', { name: 'Источник дохода' }),
    'Новая работа',
  );
  await user.click(screen.getByRole('combobox', { name: 'Группа доходов' }));
  await user.click(await screen.findByRole('option', { name: 'Подработка' }));
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить правило' }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  const request = mockTransport.mock.calls.find(
    ([r]) => r.method === 'POST' && r.url.endsWith('/rules'),
  )![0];
  expect(request.body).toMatchObject({
    dataset: 'incomes',
    source: 'Новая работа',
    groupId: groups[1].groupId,
  });
  expect(request.body.economicRole).toBeUndefined();
});
it.each(['approved', 'explicit_unclassified', 'cleared'] as const)(
  'manual %s sends one explicit command with facts and never invokes legacy PUT',
  async (state) => {
    const initial = state === 'cleared' ? approved() : read();
    mockTransport.mockImplementation(async () => ({ data: wrap(initial) }));
    const accepted = jest.fn(),
      close = jest.fn(),
      user = userEvent.setup();
    put.mockResolvedValue({
      ok: true,
      decision:
        state === 'approved'
          ? approved()
          : read({
              status: state,
              storedState: state,
              decisionRevision: state === 'cleared' ? 2 : 1,
            }),
    });
    setup(
      <OperationPanel
        initial={initial}
        operation={operationFromRead(initial, 1234)}
        owner={{
          userId: owner,
          sessionGeneration: getSessionSnapshot().generation,
        }}
        groups={[group()]}
        available
        requestScope="one"
        onDecision={accepted}
        onClose={close}
      />,
    );
    if (state === 'approved') {
      await user.click(
        await screen.findByRole('combobox', { name: 'Группа расходов' }),
      );
      await user.click(
        await within(await screen.findByRole('listbox')).findByRole('option', {
          name: 'Автомобиль',
        }),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Классифицировать' }));
    } else
      fireEvent.click(
        await screen.findByRole('button', {
          name:
            state === 'cleared'
              ? 'Сбросить классификацию'
              : 'Оставить без классификации',
        }),
      );
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][0].intent.expectedFacts).toEqual(initial.facts);
    expect(put.mock.calls[0][0].intent.state).toBe(state);
    expect(accepted).toHaveBeenCalledTimes(1);
  },
);
it('unknown manual outcome retains editor, never retries PUT and offers read-only reconcile', async () => {
  const close = jest.fn(),
    user = userEvent.setup();
  put.mockResolvedValue({ ok: false, code: 'unknown' });
  setup(
    <OperationPanel
      initial={read()}
      operation={operationFromRead(read(), 1234)}
      owner={{
        userId: owner,
        sessionGeneration: getSessionSnapshot().generation,
      }}
      groups={[group()]}
      available
      requestScope="one"
      onDecision={jest.fn()}
      onClose={close}
    />,
  );
  await user.click(
    await screen.findByRole('combobox', { name: 'Группа расходов' }),
  );
  await user.click(
    await within(await screen.findByRole('listbox')).findByRole('option', {
      name: 'Автомобиль',
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Классифицировать' }));
  await screen.findByText(/Результат записи неизвестен/);
  expect(close).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: 'Классифицировать' }),
  ).toBeDisabled();
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Сверить результат без повторной записи',
    }),
  );
  await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
  expect(put.mock.calls[1][0].reconcile).toBe(true);
});
it('statistics shows server-signed totals and a clear planning compatibility boundary', async () => {
  const data = report([approved({ group: group({ status: 'archived' }) })]);
  mockTransport.mockImplementation(async () => ({
    data: wrap({ ...data, operations: [] }),
  }));
  const view = setup(<Statistics period={period} />);
  await screen.findByRole('table', { name: 'Группы расходов' });
  expect(screen.getByText('Автомобиль · в архиве')).toBeVisible();
  expect(mockTransport.mock.calls[0][0].body.includeOperations).toBe(false);
  view.rerender(
    <MemoryRouter>
      <Statistics
        period={period}
        mode="planning"
      />
    </MemoryRouter>,
  );
  expect(
    screen.getByText(/Планирование по пяти фиксированным слоям/),
  ).toBeVisible();
});
it('workspace uses one v3 report, keeps other statuses after success and never starts legacy reads', async () => {
  const user = userEvent.setup();
  const initial = report([read(), approved({ operationId: '3'.repeat(24) })]);
  mockTransport.mockImplementation(async (r) => {
    if (r.url.endsWith('/report')) return { data: wrap(initial) };
    if (r.url.startsWith('/classification-groups?')) return { data: page() };
    if (r.url.endsWith('/rules')) return { data: wrap({ rules: [] }) };
    return { data: wrap(read()) };
  });
  put.mockResolvedValue({ ok: true, decision: approved() });
  setup(<Workspace period={period} />);
  const rows = await screen.findAllByRole('button', {
    name: 'Синтетическое топливо',
  });
  fireEvent.click(rows[0]);
  await user.click(
    await screen.findByRole('combobox', { name: 'Группа расходов' }),
  );
  await user.click(
    await within(await screen.findByRole('listbox')).findByRole('option', {
      name: 'Автомобиль',
    }),
  );
  const before = mockTransport.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Классифицировать' }));
  await waitFor(() =>
    expect(
      screen.queryByRole('region', { name: 'Проверка операции' }),
    ).not.toBeInTheDocument(),
  );
  expect(
    screen.getByRole('button', { name: 'Классифицировано (2)' }),
  ).toBeVisible();
  expect(mockTransport.mock.calls).toHaveLength(before);
  expect(
    mockTransport.mock.calls.every(
      ([r]) => !r.url.startsWith('/classifications/'),
    ),
  ).toBe(true);
});
it('session retirement removes old-owner group data and does not accept late mutations', async () => {
  setup(<GroupsPage />);
  await screen.findByRole('region', { name: 'Группа Автомобиль' });
  await act(async () => {
    const p = transitionSession(() => {});
    completeSessionTransition(getSessionSnapshot().generation);
    await p;
  });
  expect(
    screen.queryByRole('region', { name: 'Группа Автомобиль' }),
  ).not.toBeInTheDocument();
});

it('backend batch preview is read-only, chunks 201 identities and writes only after separate confirmation', async () => {
  const reads = Array.from({ length: 201 }, (_, i) =>
    read({ operationId: (i + 1).toString(16).padStart(24, '0') }),
  );
  const rows = reads.map((decision) => ({
    decision,
    operation: operationFromRead(decision, 1234),
  }));
  mockTransport.mockImplementation(async (r) => {
    if (r.url.endsWith('/preview'))
      return {
        data: wrap({
          version: 'classification-group-preview-v3',
          window: { startInclusive: start, endExclusive: end },
          proposals: r.body.operations.map((o: { operationId: string }) =>
            proposal({ operationId: o.operationId }),
          ),
          consistency: 'observed_only_non_atomic',
        }),
      };
    if (r.url.startsWith('/classification-groups?')) return { data: page() };
    return { data: wrap({ rules: [rule()] }) };
  });
  put.mockImplementation(async (o) => ({
    ok: true,
    decision: approved({ operationId: o.read.operationId }),
  }));
  const accepted = jest.fn();
  setup(
    <BatchDialog
      owner={{
        userId: owner,
        sessionGeneration: getSessionSnapshot().generation,
      }}
      period={period}
      dataset="expenses"
      rows={rows}
      rules={[rule()]}
      groups={groups}
      catalog={catalog()}
      snapshot="stable"
      ready
      onDecision={accepted}
      onRefresh={jest.fn()}
    />,
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Автоматически классифицировать' }),
  );
  await screen.findByText('Подходящих операций: 201. Пропущено: 0.');
  expect(put).not.toHaveBeenCalled();
  expect(
    mockTransport.mock.calls
      .filter(([r]) => r.url.endsWith('/preview'))
      .map(([r]) => r.body.operations.length),
  ).toEqual([100, 100, 1]);
  fireEvent.click(
    screen.getByRole('button', { name: 'Применить к 201 операциям' }),
  );
  await screen.findByText(
    'Успешно: 201. Ошибки/конфликты: 0. Неизвестный результат: 0.',
  );
  expect(put).toHaveBeenCalledTimes(201);
  expect(accepted).toHaveBeenCalledTimes(201);
  expect(
    screen.getByRole('button', { name: 'Применить к 201 операциям' }),
  ).toBeDisabled();
});
it('metadata changes before batch confirmation invalidate the old preview without PUT', async () => {
  let changed = false;
  mockTransport.mockImplementation(async (r) => {
    if (r.url.endsWith('/preview'))
      return {
        data: wrap({
          version: 'classification-group-preview-v3',
          window: { startInclusive: start, endExclusive: end },
          proposals: [proposal()],
          consistency: 'observed_only_non_atomic',
        }),
      };
    if (r.url.startsWith('/classification-groups?'))
      return {
        data: page(
          changed ? [group({ name: 'Изменена', revision: 2 })] : [group()],
        ),
      };
    return { data: wrap({ rules: [rule()] }) };
  });
  setup(
    <BatchDialog
      owner={{
        userId: owner,
        sessionGeneration: getSessionSnapshot().generation,
      }}
      period={period}
      dataset="expenses"
      rows={[{ decision: read(), operation: operationFromRead(read(), 1234) }]}
      rules={[rule()]}
      groups={groups}
      catalog={catalog()}
      snapshot="stable"
      ready
      onDecision={jest.fn()}
      onRefresh={jest.fn()}
    />,
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Автоматически классифицировать' }),
  );
  await screen.findByText('Подходящих операций: 1. Пропущено: 0.');
  changed = true;
  fireEvent.click(
    screen.getByRole('button', { name: 'Применить к 1 операциям' }),
  );
  await screen.findByText(/Запись не начата/);
  expect(put).not.toHaveBeenCalled();
});
it('cancellation during metadata preflight stops the batch before any financial PUT', async () => {
  let complete!: (r: unknown) => void;
  mockTransport.mockImplementation(async (r) => {
    if (r.url.endsWith('/preview'))
      return {
        data: wrap({
          version: 'classification-group-preview-v3',
          window: { startInclusive: start, endExclusive: end },
          proposals: [proposal()],
          consistency: 'observed_only_non_atomic',
        }),
      };
    if (r.url.startsWith('/classification-groups?'))
      return new Promise((done) => {
        complete = done;
      });
    return { data: wrap({ rules: [rule()] }) };
  });
  setup(
    <BatchDialog
      owner={{
        userId: owner,
        sessionGeneration: getSessionSnapshot().generation,
      }}
      period={period}
      dataset="expenses"
      rows={[{ decision: read(), operation: operationFromRead(read(), 1234) }]}
      rules={[rule()]}
      groups={groups}
      catalog={catalog()}
      snapshot="stable"
      ready
      onDecision={jest.fn()}
      onRefresh={jest.fn()}
    />,
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Автоматически классифицировать' }),
  );
  await screen.findByText('Подходящих операций: 1. Пропущено: 0.');
  fireEvent.click(
    screen.getByRole('button', { name: 'Применить к 1 операциям' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Остановить обработку' }));
  await act(async () => {
    complete({ data: page() });
  });
  await screen.findByRole('button', { name: 'Закрыть' });
  expect(put).not.toHaveBeenCalled();
});
it('catalog navigation exposes groups beyond the first hundred and searches the full loaded catalog', async () => {
  const all = Array.from({ length: 101 }, (_, i) =>
    group({
      groupId: `custom:10000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      name: `Группа ${i}`,
    }),
  );
  mockTransport.mockImplementation(async (request) => {
    const url = typeof request === 'string' ? request : request.url;
    return {
      data: url.includes('after=')
        ? page(all.slice(100))
        : page(all.slice(0, 100), 'f'.repeat(24)),
    };
  });
  setup(<GroupsPage />);
  await screen.findByRole('region', { name: 'Группа Группа 0' });
  expect(
    screen.queryByRole('region', { name: 'Группа Группа 100' }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Перейти на страницу групп 5' }),
  );
  await screen.findByRole('region', { name: 'Группа Группа 100' });
  fireEvent.change(screen.getByLabelText('Поиск группы'), {
    target: { value: 'Группа 100' },
  });
  expect(screen.getByText('Групп: 1. Страница 1 из 1.')).toBeVisible();
  expect(
    screen.getByRole('region', { name: 'Группа Группа 100' }),
  ).toBeVisible();
});
