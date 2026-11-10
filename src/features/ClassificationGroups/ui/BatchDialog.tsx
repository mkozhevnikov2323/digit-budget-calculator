import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import type { VerifiedOwner } from 'entities/User/model/verifiedOwner';
import { isCurrentSession } from 'shared/api/sessionBoundary';
import { checkCredentialChange } from 'shared/api/credentialObservation';
import { apiBaseUrl } from 'shared/api/baseApi';
import {
  runCategoryBatch,
  type BatchProgress,
} from 'features/HistoricalClassification/model/categoryBatch';
import { useClassificationWriteRisk } from 'features/HistoricalClassification/model/useClassificationWriteRisk';
import type { HistoryOperation } from 'features/HistoricalClassification/model/history';
import type { CalendarPeriod } from 'features/FinancialAnalytics/model/period';
import {
  useGroupPreviewMutation,
  useCheckGroupPlanMutation,
} from '../api/groupsApi';
import { groupDecisionRequest } from '../api/decisionClient';
import type {
  Group,
  GroupRead,
  GroupRule,
  Dataset,
  Proposal,
  Catalog,
} from '../model/contract';
import { groupCandidates, type GroupCandidate } from '../model/preview';
import { diagnosticLabel } from './GroupSelect';
export const BatchDialog = ({
  owner,
  period,
  dataset,
  rows,
  rules,
  groups,
  catalog,
  snapshot,
  ready,
  onDecision,
  onRefresh,
}: {
  owner: VerifiedOwner;
  period: CalendarPeriod;
  dataset: Dataset;
  rows: { operation: HistoryOperation; decision: GroupRead }[];
  rules: GroupRule[];
  groups: Group[];
  catalog: Catalog;
  snapshot: string;
  ready: boolean;
  onDecision: (d: GroupRead) => void;
  onRefresh: () => void;
}) => {
  const risk = useClassificationWriteRisk(),
    [preview] = useGroupPreviewMutation(),
    [checkPlan] = useCheckGroupPlanMutation();
  const [plan, setPlan] = useState<{
      snapshot: string;
      items: GroupCandidate[];
      proposals: Proposal[];
    } | null>(null),
    [open, setOpen] = useState(false),
    [loading, setLoading] = useState(false),
    [running, setRunning] = useState(false),
    [progress, setProgress] = useState<BatchProgress | null>(null),
    [error, setError] = useState('');
  const live = useRef(true),
    used = useRef(false),
    preparing = useRef(false),
    run = useRef<{ cancelled: boolean; controller: AbortController } | null>(
      null,
    ),
    latest = useRef({ snapshot, ready });
  latest.current = { snapshot, ready };
  const stop = () => {
    if (run.current) {
      run.current.cancelled = true;
      run.current.controller.abort();
    }
  };
  useEffect(() => {
    live.current = true;
    const retire = (e: PageTransitionEvent) => {
      if (e.type === 'pageshow' && !e.persisted) return;
      live.current = false;
      stop();
    };
    window.addEventListener('pagehide', retire);
    window.addEventListener('pageshow', retire);
    return () => {
      live.current = false;
      stop();
      window.removeEventListener('pagehide', retire);
      window.removeEventListener('pageshow', retire);
    };
  }, []);
  const current = () =>
    live.current &&
    isCurrentSession(owner.sessionGeneration) &&
    !checkCredentialChange();
  useEffect(() => {
    if (plan && (plan.snapshot !== snapshot || !ready)) stop();
  }, [snapshot, ready, plan]);
  const prepare = async () => {
    if (preparing.current || running || !ready || !current()) return;
    preparing.current = true;
    used.current = false;
    setLoading(true);
    setOpen(true);
    setPlan(null);
    setProgress(null);
    setError('');
    const original = snapshot;
    try {
      const selected = rows.filter((r) => r.operation.dataset === dataset),
        proposals: Proposal[] = [];
      // Serial bounded chunks; no concurrent preview storm and no writes.
      for (let i = 0; i < selected.length; i += 100) {
        if (
          !current() ||
          latest.current.snapshot !== original ||
          !latest.current.ready
        )
          return;
        const chunk = selected
          .slice(i, i + 100)
          .map((r) => ({
            dataset: r.operation.dataset,
            operationId: r.operation.operationId,
          }));
        proposals.push(
          ...(await preview({
            ...owner,
            startInclusive: period.startInclusive,
            endExclusive: period.endExclusive,
            operations: chunk,
          }).unwrap()),
        );
      }
      if (
        current() &&
        latest.current.snapshot === original &&
        latest.current.ready
      )
        setPlan({
          snapshot: original,
          proposals,
          items: groupCandidates(proposals, selected, rules, risk.has),
        });
    } catch {
      if (current())
        setError(
          'Не удалось получить полный предпросмотр. Запись не выполнялась. Обновите правила и группы.',
        );
    } finally {
      preparing.current = false;
      if (current()) setLoading(false);
    }
  };
  const start = async () => {
    if (
      !plan?.items.length ||
      used.current ||
      running ||
      !current() ||
      !ready ||
      plan.snapshot !== snapshot
    )
      return;
    used.current = true;
    const active = { cancelled: false, controller: new AbortController() };
    run.current = active;
    setRunning(true);
    try {
      await checkPlan({ ...owner, catalog, rules }).unwrap();
    } catch {
      if (current()) {
        setError(
          'Правила или группы изменились либо проверка недоступна. Сформируйте новый предпросмотр. Запись не начата.',
        );
        setPlan(null);
        setRunning(false);
      }
      return;
    }
    if (
      !current() ||
      active.cancelled ||
      !latest.current.ready ||
      latest.current.snapshot !== plan.snapshot
    ) {
      if (current()) setRunning(false);
      return;
    }
    const isActive = () =>
      current() &&
      !active.cancelled &&
      latest.current.ready &&
      latest.current.snapshot === plan.snapshot;
    const result = await runCategoryBatch(plan.items, {
      current: isActive,
      acquire: risk.acquire,
      clear: risk.clear,
      write: (item) =>
        groupDecisionRequest({
          baseUrl: apiBaseUrl,
          generation: owner.sessionGeneration,
          current: isActive,
          signal: active.controller.signal,
          read: item.decision,
          intent: {
            version: 'classification-group-decision-v3',
            requestId: crypto.randomUUID(),
            expectedRevision: item.proposal.expectedRevision,
            state: 'approved',
            groupId: item.proposal.match!.groupId,
            expectedFacts: item.proposal.expectedFacts,
          },
        }),
      accepted: onDecision,
      progress: (p) => {
        if (current()) setProgress(p);
      },
    });
    if (current()) {
      setRunning(false);
      setProgress(result);
    }
  };
  const planCurrent = ready && plan?.snapshot === snapshot;
  return (
    <>
      <Button
        variant="outlined"
        disabled={!ready || loading || running}
        onClick={() => void prepare()}
      >
        Автоматически классифицировать
      </Button>
      <Dialog
        open={open}
        fullWidth
        maxWidth="md"
        onClose={() => {
          if (running) stop();
          else if (!loading) setOpen(false);
        }}
        aria-labelledby="groups-batch-title"
      >
        <DialogTitle id="groups-batch-title">
          Предварительная классификация{' '}
          {dataset === 'expenses' ? 'расходов' : 'доходов'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            <Alert severity="info">
              Предпросмотр ничего не сохраняет. Подтверждение применяет только
              подходящие ранее не классифицированные операции. Одновременно
              обрабатываются не более трёх операций.
            </Alert>
            {loading && (
              <Typography role="status">
                Получение полного предпросмотра…
              </Typography>
            )}
            {error && <Alert severity="error">{error}</Alert>}
            {plan && (
              <>
                <Typography>
                  Подходящих операций: {plan.items.length}. Пропущено:{' '}
                  {plan.proposals.length - plan.items.length}.
                </Typography>
                {!planCurrent && (
                  <Alert severity="warning">
                    Правила или группы изменились. Сформируйте новый
                    предпросмотр.
                  </Alert>
                )}
                {plan.proposals.map((p) => (
                  <Typography
                    key={`${p.dataset}/${p.operationId}`}
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    {rows.find(
                      (r) =>
                        r.operation.operationId === p.operationId &&
                        r.operation.dataset === p.dataset,
                    )?.operation.facts.title ??
                      rows.find(
                        (r) =>
                          r.operation.operationId === p.operationId &&
                          r.operation.dataset === p.dataset,
                      )?.operation.facts.source ??
                      p.operationId}{' '}
                    —{' '}
                    {p.match
                      ? `${groups.find((g) => g.groupId === p.match!.groupId)?.name ?? 'Недоступная группа'} · правило ${rules.find((r) => r.id === p.match!.ruleId)?.dataset === 'expenses' ? [rules.find((r) => r.id === p.match!.ruleId)?.category, rules.find((r) => r.id === p.match!.ruleId)?.title].filter(Boolean).join(' · ') : (rules.find((r) => r.id === p.match!.ruleId)?.source ?? 'недоступно')} · ${diagnosticLabel(p.match.diagnostic)}`
                      : 'Подходящего правила нет'}
                    {!p.eligible ? ' · пропущено' : ''}
                  </Typography>
                ))}
              </>
            )}
            {progress && (
              <Stack role="status">
                <Typography>
                  Успешно: {progress.success}. Ошибки/конфликты:{' '}
                  {progress.failed}. Неизвестный результат: {progress.unknown}.
                </Typography>
                <Typography>
                  Не отправлено:{' '}
                  {progress.total - progress.started - progress.skipped}
                </Typography>
              </Stack>
            )}
            {!!progress?.unknown && (
              <Alert severity="warning">
                Неизвестные результаты не повторяются. Выполните только чтение
                состояния; для новых действий требуется новый явный
                предпросмотр.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          {running ? (
            <Button onClick={stop}>Остановить обработку</Button>
          ) : (
            <>
              <Button
                disabled={loading}
                onClick={() => setOpen(false)}
              >
                Закрыть
              </Button>
              <Button
                disabled={loading || !ready}
                onClick={() => void prepare()}
              >
                Сформировать новый предпросмотр
              </Button>
              {!!progress?.unknown && (
                <Button
                  onClick={() => {
                    setOpen(false);
                    onRefresh();
                  }}
                >
                  Проверить состояние без повторной записи
                </Button>
              )}
              <Button
                disabled={
                  loading || used.current || !planCurrent || !plan?.items.length
                }
                onClick={() => void start()}
              >
                Применить к {plan?.items.length ?? 0} операциям
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};
