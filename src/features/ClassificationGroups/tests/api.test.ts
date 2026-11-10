/** @jest-environment node */
import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from 'shared/api/baseApi';
import { groupsApi } from '../api/groupsApi';
import {
  getSessionSnapshot,
  transitionSession,
  completeSessionTransition,
} from 'shared/api/sessionBoundary';
import {
  approved,
  catalog,
  custom,
  end,
  group,
  owner,
  page,
  read,
  report,
  rule,
  start,
  wrap,
} from './fixtures';
const mockTransport = jest.fn();
jest.mock('shared/api/baseApi', () => {
  const { createApi } = jest.requireActual<
    typeof import('@reduxjs/toolkit/query/react')
  >('@reduxjs/toolkit/query/react');
  return {
    baseApi: createApi({
      reducerPath: 'testGroups',
      baseQuery: (args: unknown) => mockTransport(args),
      tagTypes: [
        'Expense',
        'Income',
        'ClassificationGroup',
        'ClassificationGroupRule',
      ],
      endpoints: () => ({}),
    }),
  };
});
const store = () =>
  configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer },
    middleware: (g) => g().concat(baseApi.middleware),
  });
const scope = () => ({
  userId: owner,
  sessionGeneration: getSessionSnapshot().generation,
});
beforeEach(() => mockTransport.mockReset());
it('GET catalog drains pagination, contains no owner and never initializes automatically', async () => {
  const groups = Array.from({ length: 101 }, (_, i) =>
    group({
      groupId: `custom:10000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      name: 'Группа ' + i,
    }),
  );
  mockTransport
    .mockResolvedValueOnce({ data: page(groups.slice(0, 100), 'f'.repeat(24)) })
    .mockResolvedValueOnce({ data: page(groups.slice(100)) });
  const s = store(),
    q = s.dispatch(groupsApi.endpoints.groupCatalog.initiate(scope()));
  try {
    expect((await q).data?.groups).toHaveLength(101);
    expect(mockTransport).toHaveBeenCalledTimes(2);
    for (const [r] of mockTransport.mock.calls) {
      expect(r.method).toBeUndefined();
      expect(r.url).not.toContain(owner);
      expect(r.url).not.toContain('initialize');
    }
  } finally {
    q.unsubscribe();
    s.dispatch(baseApi.util.resetApiState());
  }
});
it('quarantines obsolete responses across owner/session changes', async () => {
  let done!: (r: unknown) => void;
  mockTransport.mockReturnValue(
    new Promise((r) => {
      done = r;
    }),
  );
  const s = store(),
    q = s.dispatch(groupsApi.endpoints.groupCatalog.initiate(scope()));
  const next = transitionSession(() => {});
  completeSessionTransition(getSessionSnapshot().generation);
  await next;
  done({ data: page() });
  try {
    expect((await q).data).toBeUndefined();
    expect((await q).isError).toBe(true);
  } finally {
    q.unsubscribe();
    s.dispatch(baseApi.util.resetApiState());
  }
});
it.each([400, 401, 404, 409, 503])(
  'retains API %s metadata error without a false confirmed result',
  async (status) => {
    mockTransport.mockResolvedValue({
      error: {
        status,
        data: {
          version: 'classification-groups-v3',
          error: { code: 'rejected' },
          persistence: 'not_applied',
        },
      },
    });
    const s = store();
    try {
      const r = await s.dispatch(
        groupsApi.endpoints.groupMetadata.initiate({
          ...scope(),
          kind: 'group',
          method: 'POST',
          body: { dataset: 'expenses', name: 'Автомобиль' },
        }),
      );
      expect(r.data).toBeUndefined();
      expect(r.error).toMatchObject({ status });
    } finally {
      s.dispatch(baseApi.util.resetApiState());
    }
  },
);
it('checks group revisions/intent and rule etag without financial invalidation', async () => {
  const s = store();
  mockTransport.mockResolvedValueOnce({
    data: wrap(group({ revision: 2, name: 'Семья' })),
  });
  try {
    expect(
      (
        await s.dispatch(
          groupsApi.endpoints.groupMetadata.initiate({
            ...scope(),
            kind: 'group',
            method: 'PATCH',
            id: custom,
            body: { expectedRevision: 1, name: 'Семья' },
          }),
        )
      ).data,
    ).toEqual({ confirmed: true });
    expect(mockTransport.mock.calls[0][0].body).toEqual({
      expectedRevision: 1,
      name: 'Семья',
    });
    mockTransport.mockResolvedValueOnce({
      data: wrap(group({ revision: 2, name: 'Other' })),
    });
    expect(
      (
        await s.dispatch(
          groupsApi.endpoints.groupMetadata.initiate({
            ...scope(),
            kind: 'group',
            method: 'PATCH',
            id: custom,
            body: { expectedRevision: 1, name: 'Семья' },
          }),
        )
      ).error,
    ).toMatchObject({ error: 'GROUP_WRITE_UNKNOWN' });
    mockTransport.mockResolvedValueOnce({
      data: wrap(rule({ revision: 2, enabled: false, diagnostic: 'disabled' })),
    });
    expect(
      (
        await s.dispatch(
          groupsApi.endpoints.groupMetadata.initiate({
            ...scope(),
            kind: 'rule',
            method: 'PATCH',
            id: rule().id,
            body: { expectedEtag: rule().etag, enabled: false },
          }),
        )
      ).data,
    ).toEqual({ confirmed: true });
    expect(mockTransport.mock.calls[2][0].url).toBe(
      '/classification-groups/rules/' + rule().id,
    );
  } finally {
    s.dispatch(baseApi.util.resetApiState());
  }
});
it('uses v3 readers/report exclusively and rejects incomplete responses rather than displaying zero', async () => {
  const s = store();
  mockTransport.mockResolvedValueOnce({ data: wrap(approved()) });
  const q = s.dispatch(
    groupsApi.endpoints.groupRead.initiate({
      ...scope(),
      dataset: 'expenses',
      operationId: read().operationId,
      requestScope: 'one',
    }),
  );
  try {
    expect((await q).data?.groupId).toBe(custom);
    expect(mockTransport.mock.calls[0][0].url).toContain(
      '/classification-groups/operations/',
    );
    mockTransport.mockResolvedValueOnce({
      data: wrap({ ...report(), operations: [] }),
    });
    const r = await s.dispatch(
      groupsApi.endpoints.groupReport.initiate({
        ...scope(),
        startInclusive: start,
        endExclusive: end,
        includeOperations: true,
        requestScope: 'two',
      }),
    );
    expect(r.isError).toBe(true);
    expect(r.data).toBeUndefined();
  } finally {
    q.unsubscribe();
    s.dispatch(baseApi.util.resetApiState());
  }
});
it('fresh metadata check rejects rules/group changes without writing or converting legacy rules', async () => {
  const s = store();
  mockTransport
    .mockResolvedValueOnce({ data: page() })
    .mockResolvedValueOnce({
      data: wrap({ rules: [rule({ etag: 'c'.repeat(64) })] }),
    });
  try {
    const r = await s.dispatch(
      groupsApi.endpoints.checkGroupPlan.initiate({
        ...scope(),
        catalog: catalog(),
        rules: [rule()],
      }),
    );
    expect(r.error).toBeDefined();
    expect(
      mockTransport.mock.calls.every(([r]) => r.method === undefined),
    ).toBe(true);
  } finally {
    s.dispatch(baseApi.util.resetApiState());
  }
});
