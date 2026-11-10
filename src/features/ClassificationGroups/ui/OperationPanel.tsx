import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import type { VerifiedOwner } from 'entities/User/model/verifiedOwner';
import { apiBaseUrl } from 'shared/api/baseApi';
import { isCurrentSession } from 'shared/api/sessionBoundary';
import { checkCredentialChange } from 'shared/api/credentialObservation';
import { useClassificationWriteRisk } from 'features/HistoricalClassification/model/useClassificationWriteRisk';
import { SourceFactsView } from 'features/HistoricalClassification/ui/SourceFactsView';
import type { HistoryOperation } from 'features/HistoricalClassification/model/history';
import type { DecisionState } from 'features/HistoricalClassification/model/contract';
import { useGroupReadQuery } from '../api/groupsApi';
import { groupDecisionRequest, type GroupIntent } from '../api/decisionClient';
import type { Group, GroupRead } from '../model/contract';
import { GroupSelect, groupStatus } from './GroupSelect';
export const OperationPanel = ({
  initial,
  operation,
  owner,
  groups,
  available,
  onDecision,
  onClose,
  requestScope,
}: {
  initial: GroupRead;
  operation: HistoryOperation;
  owner: VerifiedOwner;
  groups: Group[];
  available: boolean;
  onDecision: (d: GroupRead) => void;
  onClose: () => void;
  requestScope: string;
}) => {
  const query = useGroupReadQuery(
    {
      ...owner,
      dataset: initial.dataset,
      operationId: initial.operationId,
      requestScope,
    },
    { refetchOnMountOrArgChange: true },
  );
  const risk = useClassificationWriteRisk();
  if (query.isError)
    return (
      <Stack>
        <Alert severity="error">
          Не удалось проверить актуальные факты выбранной операции. Запись
          недоступна.
        </Alert>
        <Button onClick={() => void query.refetch()}>
          Перечитать операцию
        </Button>
      </Stack>
    );
  if (!query.currentData || query.isFetching)
    return <Typography role="status">Проверка выбранной операции…</Typography>;
  return (
    <Editor
      key={`${query.requestId}/${query.currentData.sourceFingerprint}/${query.currentData.decisionRevision}`}
      read={query.currentData}
      operation={operation}
      owner={owner}
      groups={groups}
      available={available}
      onDecision={onDecision}
      onClose={onClose}
      refresh={async () => {
        const d = await query.refetch().unwrap();
        if (
          isCurrentSession(owner.sessionGeneration) &&
          !checkCredentialChange()
        ) {
          risk.clear(operation);
          onDecision(d);
        }
      }}
    />
  );
};
const Editor = ({
  read,
  operation,
  owner,
  groups,
  available,
  onDecision,
  onClose,
  refresh,
}: {
  read: GroupRead;
  operation: HistoryOperation;
  owner: VerifiedOwner;
  groups: Group[];
  available: boolean;
  onDecision: (d: GroupRead) => void;
  onClose: () => void;
  refresh: () => Promise<void>;
}) => {
  const initial =
    read.status === 'approved' &&
    groups.some((g) => g.groupId === read.groupId && g.status === 'active')
      ? (read.groupId ?? '')
      : '';
  const [selected, setSelected] = useState(initial),
    [busy, setBusy] = useState(false),
    [blocked, setBlocked] = useState(false),
    [message, setMessage] = useState('');
  const risk = useClassificationWriteRisk(),
    live = useRef(true),
    active = useRef(false),
    controller = useRef(new AbortController()),
    pending = useRef<GroupIntent | null>(null);
  useEffect(() => {
    live.current = true;
    controller.current = new AbortController();
    const retire = (e: PageTransitionEvent) => {
      if (e.type === 'pageshow' && !e.persisted) return;
      live.current = false;
      controller.current.abort();
      setBlocked(true);
    };
    window.addEventListener('pagehide', retire);
    window.addEventListener('pageshow', retire);
    return () => {
      live.current = false;
      controller.current.abort();
      window.removeEventListener('pagehide', retire);
      window.removeEventListener('pageshow', retire);
    };
  }, []);
  const current = () =>
    live.current &&
    isCurrentSession(owner.sessionGeneration) &&
    !checkCredentialChange();
  const locked = busy || blocked || risk.has(operation) || !available;
  const run = async (state: DecisionState, reconcile = false) => {
    if (
      active.current ||
      !current() ||
      !available ||
      (!reconcile &&
        (locked ||
          (state === 'approved' &&
            (!selected ||
              (selected === initial && read.status === 'approved'))) ||
          !risk.acquire(operation))) ||
      (reconcile && !pending.current)
    )
      return;
    const intent = reconcile
      ? pending.current!
      : {
          version: 'classification-group-decision-v3' as const,
          requestId: crypto.randomUUID(),
          expectedRevision: read.decisionRevision,
          state,
          ...(state === 'approved' ? { groupId: selected } : {}),
          expectedFacts: read.facts,
        };
    if (!reconcile) pending.current = intent;
    active.current = true;
    setBusy(true);
    setMessage('');
    const result = await groupDecisionRequest({
      baseUrl: apiBaseUrl,
      generation: owner.sessionGeneration,
      current,
      signal: controller.current.signal,
      read,
      intent,
      reconcile,
    });
    if (!current()) return;
    if (result.ok) {
      risk.clear(operation);
      pending.current = null;
      onDecision(result.decision);
      if (result.decision.status !== 'stale') onClose();
      else {
        setBlocked(true);
        setMessage('Исходные факты изменились. Решение требует обновления.');
      }
    } else {
      setBlocked(true);
      if (result.code === 'conflict' || result.code === 'unavailable')
        risk.clear(operation);
      setMessage(
        result.code === 'conflict'
          ? 'Конфликт ревизии, группы или исходных фактов. Проверьте состояние перед новым решением.'
          : result.code === 'unavailable'
            ? 'Сохранение недоступно. Проверьте готовность сервера и состояние.'
            : 'Результат записи неизвестен. Доступны только чтение и сверка без повторной записи.',
      );
    }
    active.current = false;
    setBusy(false);
  };
  return (
    <Stack
      spacing={1}
      component="section"
      aria-label="Сохранение ручной классификации"
    >
      <Typography>Актуальные данные операции, проверенные сервером</Typography>
      <SourceFactsView facts={read.facts as Record<string, unknown>} />
      {read.group && (
        <Typography>
          Сохранённая группа: {read.group.name} ·{' '}
          {groupStatus(read.group.status)}
        </Typography>
      )}
      {read.status === 'stale' && (
        <Alert severity="warning">
          Исходные данные изменились. Прежняя классификация не считается
          актуальной.
        </Alert>
      )}
      <GroupSelect
        groups={groups}
        dataset={read.dataset}
        value={selected}
        onChange={setSelected}
        disabled={locked}
      />
      <Stack
        direction="row"
        gap={1}
        flexWrap="wrap"
        justifyContent="space-between"
      >
        <Stack
          direction="row"
          gap={1}
          flexWrap="wrap"
        >
          <Button
            disabled={busy}
            onClick={onClose}
          >
            Отмена
          </Button>
          <Button
            disabled={
              locked ||
              !selected ||
              (selected === initial && read.status === 'approved')
            }
            onClick={() => void run('approved')}
          >
            {read.status === 'approved'
              ? 'Сохранить изменения'
              : 'Классифицировать'}
          </Button>
        </Stack>
        <Button
          variant="outlined"
          color="inherit"
          disabled={locked || read.status === 'explicit_unclassified'}
          onClick={() => void run('explicit_unclassified')}
        >
          Оставить без классификации
        </Button>
      </Stack>
      <Button
        sx={{ alignSelf: 'flex-start' }}
        disabled={
          locked || read.status === 'unreviewed' || read.status === 'cleared'
        }
        onClick={() => void run('cleared')}
      >
        Сбросить классификацию
      </Button>
      {busy && <Typography role="status">Проверка сохранения…</Typography>}
      {message && <Alert severity="warning">{message}</Alert>}
      {(blocked || risk.has(operation)) && !busy && (
        <Stack>
          {pending.current && (
            <Button onClick={() => void run(pending.current!.state, true)}>
              Сверить результат без повторной записи
            </Button>
          )}
          <Button
            onClick={() =>
              void refresh().catch(() => {
                setMessage(
                  'Чтение недоступно. Повторная запись заблокирована.',
                );
              })
            }
          >
            Обновить состояние без повторной записи
          </Button>
        </Stack>
      )}
    </Stack>
  );
};
