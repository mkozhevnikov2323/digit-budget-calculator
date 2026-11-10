import { useAnalyticsState } from 'features/AnalyticsState/model/useAnalyticsState';
import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Button,
  Pagination,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useVerifiedOwner } from 'entities/User/model/useVerifiedOwner';
import type { VerifiedOwner } from 'entities/User/model/verifiedOwner';
import { isCurrentSession } from 'shared/api/sessionBoundary';
import { checkCredentialChange } from 'shared/api/credentialObservation';
import type { CalendarPeriod } from 'features/FinancialAnalytics/model/period';
import type { HistoryOperation } from 'features/HistoricalClassification/model/history';
import type { SourceEditTarget } from 'features/HistoricalClassification/model/sourceEdit';
import { OperationRow } from 'features/HistoricalClassification/ui/OperationRow';
import { useClassificationNavigation } from 'features/HistoricalClassification/ui/classificationNavigation';
import { dateLabel } from 'shared/lib/analytics/presentation';
import {
  useGroupCatalogQuery,
  useGroupReportQuery,
  useGroupRulesQuery,
} from '../api/groupsApi';
import {
  operationFromRead,
  type GroupRead,
  type Report,
} from '../model/contract';
import { OperationPanel } from './OperationPanel';
import { BatchDialog } from './BatchDialog';
const SourceEdit = lazy(() =>
  import('widgets/ClassificationSourceEdit/ui/ClassificationSourceEdit').then(
    (m) => ({ default: m.ClassificationSourceEdit }),
  ),
);
export default function Workspace({
  period,
  readOnly = false,
}: {
  period: CalendarPeriod;
  readOnly?: boolean;
}) {
  const owner = useVerifiedOwner();
  return owner.status === 'verified' ? (
    <OwnedWorkspace
      key={`${owner.owner.userId}/${owner.owner.sessionGeneration}/${period.startInclusive}/${period.endExclusive}`}
      owner={owner.owner}
      period={period}
      readOnly={readOnly}
    />
  ) : (
    <Alert severity="info">Нужна текущая проверка владельца.</Alert>
  );
}
const OwnedWorkspace = ({
  period,
  owner,
  readOnly,
}: {
  period: CalendarPeriod;
  owner: VerifiedOwner;
  readOnly: boolean;
}) => {
  const requestScope = useId();
  const query = useGroupReportQuery(
    {
      ...owner,
      startInclusive: period.startInclusive,
      endExclusive: period.endExclusive,
      includeOperations: true,
      requestScope,
    },
    { refetchOnMountOrArgChange: true },
  );
  const [editing, setEditing] = useState<{
    sequence: number;
    target: SourceEditTarget;
  } | null>(null);
  const sequence = useRef(0),
    scroll = useRef<{ x: number; y: number } | null>(null);
  const edit = (op: HistoryOperation) => {
    if (!isCurrentSession(owner.sessionGeneration) || checkCredentialChange())
      return;
    scroll.current = { x: window.scrollX, y: window.scrollY };
    setEditing({
      sequence: ++sequence.current,
      target: {
        dataset: op.dataset,
        operationId: op.operationId,
        ownerId: owner.userId,
        sessionGeneration: owner.sessionGeneration,
        firstDate: period.firstDate,
        lastDate: period.lastDate,
      },
    });
  };
  useLayoutEffect(() => {
    if (scroll.current && !editing && !query.isFetching) {
      const p = scroll.current;
      if (window.scrollX !== p.x || window.scrollY !== p.y)
        window.scrollTo(p.x, p.y);
      scroll.current = null;
    }
  }, [editing, query.isFetching]);
  return (
    <>
      {query.isError ? (
        <Stack>
          <Alert severity="error">
            Полная история v3 недоступна. Данные не усечены и итоги не заменены
            нулями. Проверьте готовность сервера; выберите период до 366 дней
            или более короткий период при превышении лимита 1000 операций.
          </Alert>
          <Button onClick={() => void query.refetch()}>
            Повторить загрузку
          </Button>
          <Typography>
            Агрегированная сводка доступна на странице статистики классификации.
          </Typography>
        </Stack>
      ) : query.isFetching || !query.currentData ? (
        <Typography role="status">
          Проверка операций и групп периода…
        </Typography>
      ) : (
        <Results
          key={query.requestId}
          report={query.currentData}
          period={period}
          owner={owner}
          readOnly={readOnly}
          scope={requestScope}
          edit={edit}
          refresh={() => void query.refetch()}
        />
      )}
      {editing && !readOnly && (
        <Suspense fallback={<Typography>Загрузка редактора…</Typography>}>
          <SourceEdit
            key={editing.sequence}
            target={editing.target}
            onClose={() => setEditing(null)}
          />
        </Suspense>
      )}
    </>
  );
};
const Results = ({
  report,
  period,
  owner,
  readOnly,
  scope,
  edit,
  refresh,
}: {
  report: Report;
  period: CalendarPeriod;
  owner: VerifiedOwner;
  readOnly: boolean;
  scope: string;
  edit: (op: HistoryOperation) => void;
  refresh: () => void;
}) => {
  const nav = useClassificationNavigation(
      `${period.startInclusive}/${period.endExclusive}`,
    ),
    [selected, setSelected] = useState<string | null>(null),
    [updates, setUpdates] = useState<Record<string, GroupRead>>({}),
    [groupFilter, setGroupFilter] = useAnalyticsState(
      'classificationGroupFilter',
      'all',
    );
  const catalog = useGroupCatalogQuery(owner, {
      refetchOnMountOrArgChange: true,
    }),
    rules = useGroupRulesQuery(owner, {
      skip: readOnly,
      refetchOnMountOrArgChange: true,
    });
  const ready =
    !!catalog.currentData &&
    !catalog.isFetching &&
    !catalog.isError &&
    catalog.currentData.initialized;
  const batchReady =
    ready && !!rules.currentData && !rules.isFetching && !rules.isError;
  const snapshot = JSON.stringify([
    catalog.requestId,
    catalog.currentData,
    rules.requestId,
    rules.currentData,
  ]);
  const rows = report.operations.map((initial) => {
    const stored =
      updates[`${initial.dataset}/${initial.operationId}`] ?? initial;
    const fresh = catalog.currentData?.groups.find(
      (g) => g.groupId === stored.storedGroupId && g.dataset === stored.dataset,
    );
    const decision =
      fresh && stored.group && fresh.revision >= stored.group.revision
        ? { ...stored, group: fresh }
        : stored;
    return {
      decision,
      operation: operationFromRead(decision, initial.kopecks),
    };
  });
  const datasetRows = rows.filter((r) => r.operation.dataset === nav.dataset),
    counts = {
      all: datasetRows.length,
      pending: datasetRows.filter((r) => r.decision.status === 'unreviewed')
        .length,
      approved: datasetRows.filter((r) => r.decision.status === 'approved')
        .length,
    };
  const filtered = datasetRows
    .filter(
      (r) =>
        (nav.filter === 'all' ||
          r.decision.status ===
            (nav.filter === 'pending' ? 'unreviewed' : 'approved')) &&
        (groupFilter === 'all' ||
          (groupFilter === 'none'
            ? r.decision.groupId === null
            : r.decision.groupId === groupFilter)),
    )
    .sort(
      (a, b) =>
        a.operation.timestamp - b.operation.timestamp ||
        a.operation.operationId.localeCompare(b.operation.operationId),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 25)),
    page = Math.min(nav.page, pages);
  useEffect(() => {
    if (nav.page !== page)
      nav.update(nav.dataset, nav.filter, page, undefined, undefined, true);
    // URL paging preserves the existing period semantics.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.page, page]);
  useEffect(
    () => setSelected(null),
    [nav.dataset, nav.filter, page, groupFilter],
  );
  const accepted = (d: GroupRead) =>
    setUpdates((old) => ({ ...old, [`${d.dataset}/${d.operationId}`]: d }));
  const days = new Map<string, typeof rows>();
  filtered.slice((page - 1) * 25, page * 25).forEach((row) => {
    const day = dateLabel(row.operation.timestamp);
    days.set(day, [...(days.get(day) ?? []), row]);
  });
  const availableGroups = new Map(
    (catalog.currentData?.groups ?? [])
      .filter((g) => g.dataset === nav.dataset)
      .map((g) => [g.groupId, g.name]),
  );
  for (const r of datasetRows)
    if (r.decision.group && !availableGroups.has(r.decision.group.groupId))
      availableGroups.set(r.decision.group.groupId, r.decision.group.name);
  return (
    <Stack spacing={1}>
      <Tabs
        value={nav.dataset}
        aria-label="Тип операций"
        onChange={(_e, dataset) => {
          setSelected(null);
          setGroupFilter('all');
          nav.update(
            dataset,
            nav.filter,
            dataset === 'incomes' ? nav.incomePage : nav.expensePage,
          );
        }}
      >
        <Tab
          value="incomes"
          label="Доходы"
        />
        <Tab
          value="expenses"
          label="Расходы"
        />
      </Tabs>
      <ToggleButtonGroup
        value={nav.filter}
        exclusive
        size="small"
        aria-label="Статус классификации"
        sx={{ flexWrap: 'wrap' }}
        onChange={(_e, f) => {
          if (f) nav.update(nav.dataset, f, 1, 1, 1);
        }}
      >
        <ToggleButton value="all">Все ({counts.all})</ToggleButton>
        <ToggleButton value="pending">
          Не классифицировано ({counts.pending})
        </ToggleButton>
        <ToggleButton value="approved">
          Классифицировано ({counts.approved})
        </ToggleButton>
      </ToggleButtonGroup>
      <TextField
        select
        label="Фильтр по группе"
        value={groupFilter}
        slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
        onChange={(e) => {
          setGroupFilter(e.target.value);
          nav.update(nav.dataset, nav.filter, 1);
        }}
      >
        <option value="all">Все группы</option>
        <option value="none">Без актуальной классификации</option>
        {[...availableGroups].map(([id, name]) => (
          <option
            key={id}
            value={id}
          >
            {name}
          </option>
        ))}
      </TextField>
      {!readOnly &&
        (!ready ? (
          <Alert severity="info">
            Для сохранения нужен готовый и явно инициализированный каталог
            групп. Настройки доступны в профиле.
          </Alert>
        ) : null)}
      {!readOnly && (
        <BatchDialog
          key={nav.dataset}
          owner={owner}
          period={period}
          dataset={nav.dataset}
          rows={rows}
          catalog={
            catalog.currentData ?? {
              groups: [],
              initialized: false,
              systemDefinitions: [],
            }
          }
          groups={catalog.currentData?.groups ?? []}
          rules={rules.currentData ?? []}
          snapshot={snapshot}
          ready={batchReady}
          onDecision={accepted}
          onRefresh={refresh}
        />
      )}
      <Button onClick={refresh}>Обновить историю</Button>
      <Typography>
        Операций: {filtered.length}. Страница {page} из {pages}.
      </Typography>
      {!filtered.length && (
        <Typography>Подходящих операций за выбранный период нет.</Typography>
      )}
      {[...days].map(([day, items]) => (
        <Stack key={day}>
          <Typography
            component="h2"
            variant="h6"
          >
            {day}
          </Typography>
          {items.map(({ operation, decision }) => (
            <OperationRow
              key={operation.operationId}
              operation={operation}
              scope={{ ...owner, requestScope: scope }}
              readOnly={readOnly}
              groupsMode
              groupDecision={decision}
              expanded={selected === operation.operationId}
              onToggle={() =>
                setSelected(
                  selected === operation.operationId
                    ? null
                    : operation.operationId,
                )
              }
              onClose={() => setSelected(null)}
              onEdit={() => edit(operation)}
              groupEditor={
                !readOnly && (
                  <OperationPanel
                    initial={decision}
                    operation={operation}
                    owner={owner}
                    groups={catalog.currentData?.groups ?? []}
                    available={ready}
                    requestScope={scope}
                    onDecision={accepted}
                    onClose={() => setSelected(null)}
                  />
                )
              }
            />
          ))}
        </Stack>
      ))}
      <Pagination
        count={pages}
        page={page}
        onChange={(_e, p) => nav.update(nav.dataset, nav.filter, p)}
        getItemAriaLabel={(type, p, current) =>
          type === 'page'
            ? current
              ? `Страница ${p}`
              : `Перейти на страницу ${p}`
            : type === 'next'
              ? 'Следующая страница'
              : type === 'previous'
                ? 'Предыдущая страница'
                : 'Другие страницы'
        }
        aria-label="Страницы операций"
        sx={{ '& ul': { flexWrap: 'wrap' } }}
      />
    </Stack>
  );
};
