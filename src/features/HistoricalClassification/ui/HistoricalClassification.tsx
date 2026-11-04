import { useAnalyticsState } from 'features/AnalyticsState/model/useAnalyticsState';
import { dateLabel } from 'shared/lib/analytics/presentation';
import { useId, useMemo, useState } from 'react';
import { skipToken } from '@reduxjs/toolkit/query';
import { Alert, Button, Stack, Tabs, Tab, Typography, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useVerifiedOwner } from 'entities/User/model/useVerifiedOwner';
import type { CalendarPeriod } from 'features/FinancialAnalytics/model/period';
import type { HistoryOperation } from '../model/history';
import { useGetOwnedHistoryQuery, type DecisionQuery } from '../api/historyApi';
import { OperationRow } from './OperationRow';
import { ClassificationWorkspace } from './ClassificationWorkspace';
export const HistoricalClassification = ({period,readOnly=false}:{period:CalendarPeriod;readOnly?:boolean}) => readOnly ? <ReadOnlyHistory period={period} readOnly /> : <ClassificationWorkspace period={period}/>;


const ReadOnlyHistory = ({ period, readOnly = false }: { period: CalendarPeriod; readOnly?: boolean }) => {
  const owner = useVerifiedOwner(), instance = useId();
  const userId = owner.status === 'verified' ? owner.owner.userId : undefined;
  const generation = owner.status === 'verified' ? owner.owner.sessionGeneration : undefined;
  const key = JSON.stringify([userId, generation, period.startInclusive, period.endExclusive]);
  const [entry, setEntry] = useState({ key, sequence: 0 });
  if (entry.key !== key) setEntry({ key, sequence: entry.sequence + 1 });
  const scope = `${instance}/${entry.sequence}`;
  const args = useMemo(() => userId && generation ? { userId, sessionGeneration: generation, requestScope: scope, period } : skipToken, [userId, generation, scope, period]);
  const query = useGetOwnedHistoryQuery(args, { refetchOnMountOrArgChange: true });
  if (owner.status !== 'verified') return <Alert severity="info">Для просмотра нужна текущая проверка владельца.</Alert>;
  if (query.isError) return <Stack><Alert severity="error">Полная история недоступна. Итоги классификации не рассчитаны.</Alert><Button onClick={() => void query.refetch()}>Повторить загрузку истории</Button></Stack>;
  if (entry.key !== key || query.isFetching || !query.currentData || args === skipToken) return <Typography role="status">Загрузка полной истории…</Typography>;
  return <HistorySelection readOnly={readOnly} onRefresh={() => void query.refetch()} key={`${scope}/${query.requestId}`} operations={query.currentData.operations}
    scope={{ userId: owner.owner.userId, sessionGeneration: owner.owner.sessionGeneration, requestScope: `${scope}/${query.requestId}` }} />;
};
const HistorySelection = ({ operations, scope, readOnly, onRefresh }: { onRefresh: () => void; readOnly: boolean; operations: readonly HistoryOperation[]; scope: Omit<DecisionQuery, 'dataset' | 'operationId'> }) => {
  const [dataset, setDataset] = useAnalyticsState<'incomes' | 'expenses'>('dataset', 'incomes');
  const [incomePage, setIncomePage] = useAnalyticsState('incomePage', 0), [expensePage, setExpensePage] = useAnalyticsState('expensePage', 0);
  const [direction, setDirection] = useAnalyticsState<'asc' | 'desc'>('sortDirection', 'asc');
  const [selected, setSelected] = useState<string | null>(null);
  const filtered = operations.filter(op => op.dataset === dataset).sort((a,b) => (direction === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp) || a.operationId.localeCompare(b.operationId));
  const savedPage = dataset === 'incomes' ? incomePage : expensePage, setPage = dataset === 'incomes' ? setIncomePage : setExpensePage;
  const page = Math.min(savedPage, Math.max(0, Math.ceil(filtered.length / 25) - 1));
  const visible = filtered.slice(page * 25, page * 25 + 25);
  const groups = new Map<string, HistoryOperation[]>();
  visible.forEach(op => { const day = dateLabel(op.timestamp); groups.set(day, [...(groups.get(day) ?? []), op]); });
  return <Stack spacing={1}>
    <Tabs value={dataset} onChange={(_e, value) => { setSelected(null); setDataset(value); }} aria-label="Тип операций"><Tab value="incomes" label="Доходы" /><Tab value="expenses" label="Расходы" /></Tabs>
    <ToggleButtonGroup exclusive size="small" value={direction} aria-label="Порядок операций" onChange={(_e, value) => { if (value) { setSelected(null);setDirection(value);setIncomePage(0);setExpensePage(0); } }}><ToggleButton value="asc">Сначала старые</ToggleButton><ToggleButton value="desc">Сначала новые</ToggleButton></ToggleButtonGroup>
    <Button onClick={onRefresh}>Обновить историю</Button>
    <Typography>Операций: {filtered.length}.</Typography>
    {!filtered.length && <Typography>В записанной истории операций нет.</Typography>}
    {[...groups].map(([day, rows]) => <Stack key={day} spacing={0.5}><Typography component="h2" variant="h6">{day}</Typography>{rows.map(op => <OperationRow key={op.operationId} operation={op} scope={scope} readOnly={readOnly} expanded={selected === op.operationId} onClose={() => setSelected(null)} onToggle={() => setSelected(selected === op.operationId ? null : op.operationId)} />)}</Stack>)}
    <Stack direction="row"><Button disabled={!page} onClick={() => { setSelected(null); setPage(p => p - 1); }}>Предыдущие операции</Button><Button disabled={(page + 1) * 25 >= filtered.length} onClick={() => { setSelected(null); setPage(p => p + 1); }}>Следующие операции</Button></Stack>
  </Stack>;
};
