import { loadCatalog } from '../model/catalog';
import { baseApi } from 'shared/api/baseApi';
import { isCurrentSession } from 'shared/api/sessionBoundary';
import { closedData } from 'features/HistoricalClassification/model/contract';
import type { VerifiedOwner } from 'entities/User/model/verifiedOwner';
import {
  envelope,
  readGroup,
  readRule,
  readRules,
  readDecision,
  readReport,
  readPreview,
  type Catalog,
  type GroupRule,
  type GroupRead,
  type Report,
  type ReportRequest,
  type Proposal,
  type Dataset,
} from '../model/contract';
export const scopeKey = (s: VerifiedOwner) =>
  `${s.userId}/${s.sessionGeneration}`;
export const root = '/classification-groups';
const invalid = (unknown = false) => ({
  error: {
    status: 'CUSTOM_ERROR' as const,
    error: unknown ? 'GROUP_WRITE_UNKNOWN' : 'GROUP_RESPONSE_INVALID',
  },
});
export const groupsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    groupCatalog: b.query<Catalog, VerifiedOwner>({
      async queryFn(scope, api, _o, query) {
        try {
          const data = await loadCatalog(
            async (url) => {
              const r = await query({ url, cache: 'no-store' });
              if (r.error) throw Error('GROUP_CATALOG_UNAVAILABLE');
              return r.data;
            },
            () =>
              !api.signal.aborted && isCurrentSession(scope.sessionGeneration),
          );
          return { data };
        } catch {
          return invalid();
        }
      },
      providesTags: (_d, _e, s) => [
        { type: 'ClassificationGroup', id: scopeKey(s) },
      ],
      keepUnusedDataFor: 0,
    }),
    groupRules: b.query<GroupRule[], VerifiedOwner>({
      async queryFn(s, api, _o, query) {
        if (api.signal.aborted || !isCurrentSession(s.sessionGeneration))
          return invalid();
        const r = await query({ url: `${root}/rules`, cache: 'no-store' });
        if (!isCurrentSession(s.sessionGeneration)) return invalid();
        if (r.error) return { error: r.error };
        const data = readRules(r.data);
        return data ? { data } : invalid();
      },
      providesTags: (_d, _e, s) => [
        { type: 'ClassificationGroupRule', id: scopeKey(s) },
      ],
      keepUnusedDataFor: 0,
    }),
    groupRead: b.query<
      GroupRead,
      VerifiedOwner & {
        dataset: Dataset;
        operationId: string;
        requestScope: string;
      }
    >({
      async queryFn(s, api, _o, query) {
        if (api.signal.aborted || !isCurrentSession(s.sessionGeneration))
          return invalid();
        const r = await query({
          url: `${root}/operations/${s.dataset}/${s.operationId}`,
          cache: 'no-store',
        });
        if (!isCurrentSession(s.sessionGeneration)) return invalid();
        if (r.error) return { error: r.error };
        const data = readDecision(envelope(r.data), s.dataset, s.operationId);
        return data ? { data } : invalid();
      },
      keepUnusedDataFor: 0,
    }),
    groupReport: b.query<
      Report,
      VerifiedOwner & ReportRequest & { requestScope: string }
    >({
      async queryFn(s, api, _o, query) {
        if (
          api.signal.aborted ||
          !isCurrentSession(s.sessionGeneration) ||
          s.endExclusive - s.startInclusive > 366 * 86400000
        )
          return invalid();
        const body = {
          version: 'classification-group-report-v3',
          startInclusive: s.startInclusive,
          endExclusive: s.endExclusive,
          includeOperations: s.includeOperations,
          ...(s.dataset ? { dataset: s.dataset } : {}),
          ...(s.groupId === undefined ? {} : { groupId: s.groupId }),
        };
        const r = await query({
          url: `${root}/report`,
          method: 'POST',
          body,
          cache: 'no-store',
        });
        if (!isCurrentSession(s.sessionGeneration)) return invalid();
        if (r.error) return { error: r.error };
        const data = readReport(r.data, s);
        return data ? { data } : invalid();
      },
      providesTags: ['Expense', 'Income'],
      keepUnusedDataFor: 0,
    }),
    groupPreview: b.mutation<
      Proposal[],
      VerifiedOwner & {
        startInclusive: number;
        endExclusive: number;
        operations: { dataset: Dataset; operationId: string }[];
      }
    >({
      async queryFn(s, api, _o, query) {
        if (api.signal.aborted || !isCurrentSession(s.sessionGeneration))
          return invalid();
        const r = await query({
          url: `${root}/preview`,
          method: 'POST',
          body: {
            version: 'classification-group-preview-v3',
            startInclusive: s.startInclusive,
            endExclusive: s.endExclusive,
            operations: s.operations,
          },
          cache: 'no-store',
        });
        if (!isCurrentSession(s.sessionGeneration)) return invalid();
        if (r.error) return { error: r.error };
        const data = readPreview(r.data, s);
        return data ? { data } : invalid();
      },
    }),
    checkGroupPlan: b.mutation<
      { current: true },
      VerifiedOwner & { catalog: Catalog; rules: GroupRule[] }
    >({
      async queryFn(s, api, _o, query) {
        const current = () =>
          !api.signal.aborted && isCurrentSession(s.sessionGeneration);
        try {
          const catalog = await loadCatalog(async (url) => {
            const r = await query({ url, cache: 'no-store' });
            if (r.error) throw Error('PLAN_UNAVAILABLE');
            return r.data;
          }, current);
          const r = await query({ url: `${root}/rules`, cache: 'no-store' });
          if (!current() || r.error) return invalid();
          const rules = readRules(r.data);
          if (
            !rules ||
            JSON.stringify(catalog) !== JSON.stringify(s.catalog) ||
            JSON.stringify(rules) !== JSON.stringify(s.rules)
          )
            return invalid();
          return { data: { current: true } };
        } catch {
          return invalid();
        }
      },
    }),
    groupMetadata: b.mutation<{ confirmed: true }, MetadataWrite>({
      async queryFn(s, api, _o, query) {
        if (api.signal.aborted || !isCurrentSession(s.sessionGeneration))
          return invalid();
        const path =
          s.kind === 'initialize'
            ? '/initialize'
            : s.kind === 'rule'
              ? `/rules${s.id ? '/' + encodeURIComponent(s.id) : ''}`
              : s.id
                ? '/' + encodeURIComponent(s.id)
                : '';
        const r = await query({
          url: root + path,
          method: s.method,
          body: s.body,
          cache: 'no-store',
        });
        if (!isCurrentSession(s.sessionGeneration)) return invalid(true);
        if (r.error) return { error: r.error };
        const result = envelope(r.data);
        if (s.kind === 'initialize') {
          const o = closedData(result, ['initialized']);
          if (!o || Object.keys(o).length !== 1 || o.initialized !== true)
            return invalid(true);
        } else if (s.kind === 'rule' && s.method === 'DELETE') {
          const o = closedData(result, ['deleted']);
          if (!o || Object.keys(o).length !== 1 || o.deleted !== true)
            return invalid(true);
        } else if (s.kind === 'rule') {
          const row = readRule(result);
          if (!row || (s.id && row.id !== s.id)) return invalid(true);
          for (const [field, v] of Object.entries(s.body)) {
            if (field === 'expectedEtag') continue;
            const actual = Object.getOwnPropertyDescriptor(row, field)?.value,
              expected =
                typeof v === 'string' &&
                ['category', 'title', 'source'].includes(field)
                  ? v.trim().toLowerCase()
                  : v;
            if (
              field === 'title' && v === null
                ? actual !== undefined
                : actual !== expected
            )
              return invalid(true);
          }
        } else {
          const row = readGroup(result);
          if (
            !row ||
            (s.method === 'POST' &&
              (row.origin !== 'custom' ||
                row.revision !== 1 ||
                row.status !== 'active')) ||
            (s.id && row.groupId !== s.id) ||
            (s.method !== 'POST' &&
              row.revision !== (s.body.expectedRevision as number) + 1)
          )
            return invalid(true);
          for (const field of ['name', 'dataset', 'status'] as const)
            if (
              Object.prototype.hasOwnProperty.call(s.body, field) &&
              row[field] !== s.body[field]
            )
              return invalid(true);
          if (s.method === 'DELETE' && row.status !== 'archived')
            return invalid(true);
        }
        return { data: { confirmed: true } };
      },
      invalidatesTags: (r, _e, s) =>
        r
          ? [
              { type: 'ClassificationGroup', id: scopeKey(s) },
              { type: 'ClassificationGroupRule', id: scopeKey(s) },
            ]
          : [],
    }),
  }),
});
export type MetadataWrite = VerifiedOwner & {
  kind: 'group' | 'rule' | 'initialize';
  method: 'POST' | 'PATCH' | 'DELETE';
  id?: string;
  body: Record<string, unknown>;
};
export const {
  useGroupCatalogQuery,
  useGroupRulesQuery,
  useGroupReadQuery,
  useGroupReportQuery,
  useGroupPreviewMutation,
  useCheckGroupPlanMutation,
  useGroupMetadataMutation,
} = groupsApi;
export const failureMessage = (error: unknown) => {
  const r =
    error && typeof error === 'object'
      ? (error as { status?: unknown; data?: unknown; error?: unknown })
      : {};
  const d = closedData(r.data, ['version', 'error', 'persistence']),
    e = d && closedData(d.error, ['code']);
  const known =
    !!d &&
    Object.keys(d).length === 3 &&
    !!e &&
    Object.keys(e).length === 1 &&
    typeof e.code === 'string' &&
    d.version === 'classification-groups-v3' &&
    d.persistence === 'not_applied';
  const unknown = r.error === 'GROUP_WRITE_UNKNOWN' || !known;
  const message = unknown
    ? 'Результат записи неизвестен. Сначала проверьте состояние без повторной записи.'
    : r.status === 401
      ? 'Сессия истекла. Войдите снова.'
      : r.status === 409
        ? 'Конфликт, дубликат или недоступная группа. Обновите данные и проверьте изменения.'
        : r.status === 404
          ? 'Запись отсутствует или недоступна.'
          : r.status === 400
            ? 'Проверьте название и поля формы.'
            : r.status === 503
              ? 'Сервис v3 не готов. Проверьте миграцию и серверные флаги.'
              : 'Запрос отклонён. Обновите данные.';
  return {
    unknown,
    message,
    code: typeof e?.code === 'string' ? e.code : undefined,
  };
};
