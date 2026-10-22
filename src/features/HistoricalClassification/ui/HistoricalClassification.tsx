import { useId, useMemo, useState } from 'react';
import { skipToken } from '@reduxjs/toolkit/query';
import { Alert, Button, Checkbox, FormControlLabel, Stack, TextField, Typography } from '@mui/material';
import { useVerifiedOwner } from 'entities/User/model/useVerifiedOwner';
import type { CalendarPeriod } from 'features/FinancialAnalytics/model/period';
import { formatKopecks } from 'features/FinancialAnalytics/model/money';
import { FINANCIAL_LAYERS, type FinancialLayer } from 'features/FinancialClassification/model/types';
import { ROLE_DATASETS, type StableRole, type DecisionState } from '../model/contract';
import type { HistoryOperation } from '../model/history';
import { useGetOwnedHistoryQuery, useReadOperationClassificationQuery, type DecisionQuery } from '../api/historyApi';
import { PersistentReview } from './PersistentReview';

const labels = { unreviewed: 'Не рассмотрена', approved: 'Есть подтверждённое решение', explicit_unclassified: 'Явно без классификации',
  cleared: 'Решение сброшено', stale: 'Решение устарело', blocked: 'Решение заблокировано' };
const OperationReview = ({ operation, scope }: { operation: HistoryOperation; scope: Omit<DecisionQuery, 'dataset' | 'operationId'> }) => {
  const instance = useId();
  const query = useReadOperationClassificationQuery({ ...scope, requestScope: `${scope.requestScope}/${instance}`,
    dataset: operation.dataset, operationId: operation.operationId }, { refetchOnMountOrArgChange: true });
  const [role, setRole] = useState<StableRole>(operation.dataset === 'expenses' ? 'ordinary_expense' : 'ordinary_income');
  const [layer, setLayer] = useState<FinancialLayer>('everyday');
  const [state, setState] = useState<DecisionState>('approved');
  const [checked, setChecked] = useState(false), [confirmed, setConfirmed] = useState(false);
  const reset = () => { setChecked(false); setConfirmed(false); };
  const money = formatKopecks(operation.kopecks);
  return <Stack spacing={1} component="section" aria-label="Проверка операции">
    <Typography component="h3" variant="h6">Факты операции: {money.ok ? money.value : 'Недоступно'}</Typography>
    <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{Object.entries(operation.facts).map(([key, value]) => `${key}: ${value === null ? 'null' : value === '' ? '(пустая строка)' : String(value)}`).join('\n')}
      {!Object.prototype.hasOwnProperty.call(operation.facts, 'comment') ? '\ncomment: отсутствует' : ''}</Typography>
    {query.isFetching || !query.currentData && !query.isError ? <Typography role="status">Загрузка состояния классификации…</Typography>
      : query.isError ? <Alert severity="warning">Состояние классификации недоступно. Это не означает «не рассмотрена».</Alert>
        : query.currentData && <Alert severity="info">{labels[query.currentData.status]}. Ревизия: {query.currentData.decisionRevision ?? 'нет'}. Это отдельное наблюдение сервера, не доказательство соответствия показанным фактам.</Alert>}
    <TextField select label="Решение" value={state} slotProps={{ select: { native: true } }} onChange={e => { reset(); setState(e.target.value as DecisionState); }}>
      <option value="approved">Классифицировать</option><option value="explicit_unclassified">Явно без классификации</option><option value="cleared">Сбросить решение</option>
    </TextField>
    {state === 'approved' && <>
      <TextField select label="Экономическая роль" value={role} slotProps={{ select: { native: true } }} onChange={e => { reset(); setRole(e.target.value as StableRole); }}>
        {(Object.keys(ROLE_DATASETS) as StableRole[]).filter(r => (ROLE_DATASETS[r] as readonly string[]).includes(operation.dataset)).map(r => <option key={r} value={r}>{r}</option>)}
      </TextField>
      {role === 'ordinary_expense' && <TextField select label="Финансовый слой" value={layer} slotProps={{ select: { native: true } }} onChange={e => { reset(); setLayer(e.target.value as FinancialLayer); }}>
        {FINANCIAL_LAYERS.map(l => <option key={l} value={l}>{l}</option>)}
      </TextField>}
    </>}
    <FormControlLabel control={<Checkbox checked={checked} onChange={e => { setChecked(e.target.checked); setConfirmed(false); }} />} label="Я проверил(а) факты и временный выбор" />
    <Button disabled={!checked} onClick={() => setConfirmed(true)}>Подтвердить временный выбор</Button>
    {confirmed && <Alert severity="info">Временный выбор: {state}{state === 'approved' ? ` / ${role} / ${role === 'ordinary_expense' ? layer : 'без слоя'}` : ''}. Только в памяти, на сервер не отправлен.</Alert>}
    {query.currentData && !query.isFetching && !query.isError
      ? <PersistentReview key={JSON.stringify([state, role, layer, query.requestId])} operation={operation} scope={scope} decision={query.currentData}
        state={state} assignment={state === 'approved' ? { economicRole: role, layer: role === 'ordinary_expense' ? layer : null } : undefined}
        onSaved={() => void query.refetch()} />
      : <Button disabled>Сохранить на сервере — состояние недоступно</Button>}
  </Stack>;
};

export const HistoricalClassification = ({ period }: { period: CalendarPeriod }) => {
  const owner = useVerifiedOwner(), instance = useId();
  const userId = owner.status === 'verified' ? owner.owner.userId : undefined;
  const generation = owner.status === 'verified' ? owner.owner.sessionGeneration : undefined;
  const key = JSON.stringify([userId, generation, period.startInclusive, period.endExclusive]);
  const [entry, setEntry] = useState({ key, sequence: 0 });
  if (entry.key !== key) setEntry({ key, sequence: entry.sequence + 1 });
  const scope = `${instance}/${entry.sequence}`;
  const args = useMemo(() => userId && generation ? { userId, sessionGeneration: generation, requestScope: scope, period } : skipToken,
    [userId, generation, scope, period]);
  const query = useGetOwnedHistoryQuery(args, { refetchOnMountOrArgChange: true });
  if (owner.status !== 'verified') return <Alert severity="info">Для просмотра нужна текущая проверка владельца.</Alert>;
  if (query.isError) return <Stack><Alert severity="error">Полная история недоступна. Итоги классификации не рассчитаны.</Alert><Button onClick={() => void query.refetch()}>Повторить загрузку истории</Button></Stack>;
  if (entry.key !== key || query.isFetching || !query.currentData || args === skipToken) return <Typography role="status">Загрузка полной истории…</Typography>;
  return <HistorySelection key={`${scope}/${query.requestId}`} operations={query.currentData.operations}
    scope={{ userId: owner.owner.userId, sessionGeneration: owner.owner.sessionGeneration, requestScope: `${scope}/${query.requestId}` }} />;
};

const HistorySelection = ({ operations, scope }: { operations: readonly HistoryOperation[]; scope: Omit<DecisionQuery, 'dataset' | 'operationId'> }) => {
  const [page, setPage] = useState(0), [selection, setSelection] = useState<HistoryOperation | null>(null);
  return <Stack spacing={1}>
    <Alert severity="info">Стабильная схема financial-classification-v1. Серверное сохранение требует отдельной подготовки и проверки фактов. Смена периода, обновление истории, сессии или уход удаляют временный выбор и proof. Категория не определяет роль.</Alert>
    <Typography>Операций: {operations.length}. Состояние запрашивается только для выбранной операции.</Typography>
    {!operations.length && <Typography>В записанной истории операций нет.</Typography>}
    {operations.slice(page * 25, page * 25 + 25).map(op => {
      const label = formatKopecks(op.kopecks);
      return <Button key={`${op.dataset}/${op.operationId}`} onClick={() => setSelection(op)}>
        {op.dataset} · {new Date(op.timestamp).toISOString()} · {label.ok ? label.value : 'Недоступно'} · {op.operationId}
      </Button>;
    })}
    <Stack direction="row"><Button disabled={!page} onClick={() => setPage(p => p - 1)}>Предыдущие операции</Button>
      <Button disabled={(page + 1) * 25 >= operations.length} onClick={() => setPage(p => p + 1)}>Следующие операции</Button></Stack>
    {selection && <OperationReview key={`${selection.dataset}/${selection.operationId}`} operation={selection} scope={scope} />}
  </Stack>;
};
