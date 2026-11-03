import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useAnalyticsState } from 'features/AnalyticsState/model/useAnalyticsState';
import { roleLabel, layerLabel, dateLabel, factLabel } from 'shared/lib/analytics/presentation';
import { useId, useMemo, useState } from 'react';
import { skipToken } from '@reduxjs/toolkit/query';
import { Accordion, AccordionSummary, AccordionDetails, Alert, Button, Stack, Tabs, Tab, Typography, Chip, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useVerifiedOwner } from 'entities/User/model/useVerifiedOwner';
import type { CalendarPeriod } from 'features/FinancialAnalytics/model/period';
import { formatKopecks } from 'features/FinancialAnalytics/model/money';
import type { HistoryOperation } from '../model/history';
import { useGetOwnedHistoryQuery, useReadOperationClassificationQuery, type DecisionQuery } from '../api/historyApi';
import { OperationEditor } from './OperationEditor';
import type { ClassificationStatus } from '../model/contract';

const classificationLabel = (status: ClassificationStatus) => ({ approved: 'Классифицировано', unreviewed: 'Не классифицировано', explicit_unclassified: 'Без классификации', cleared: 'Решение сброшено', stale: 'Требует обновления', blocked: 'Недоступно' })[status];
const OperationRow = ({ operation, scope, readOnly, expanded, onToggle, onClose }: {
  operation: HistoryOperation; scope: Omit<DecisionQuery, 'dataset' | 'operationId'>; readOnly: boolean; expanded: boolean; onToggle: () => void; onClose: () => void;
}) => {
  // At most the 25 visible operations are subscribed. Read-only history does not query decisions.
  const query = useReadOperationClassificationQuery(readOnly ? skipToken : { ...scope, dataset: operation.dataset, operationId: operation.operationId }, { refetchOnMountOrArgChange: true });
  const [saved, setSaved] = useState(false);
  const decision = !query.isError && !query.isFetching ? saved ? undefined : query.currentData : undefined;
  const amount = formatKopecks(operation.kopecks);
  const title = operation.dataset === 'incomes' ? operation.facts.source : operation.facts.title;
  return <Accordion expanded={expanded} onChange={() => { if (!expanded && saved) {setSaved(false);void query.refetch();}onToggle(); }} disableGutters>
    <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-label={title || (operation.dataset === 'incomes' ? 'Поступление без названия' : 'Расход без названия')}>
      <Stack sx={{ width: '100%', minWidth: 0, overflowWrap: 'anywhere' }} spacing={0.5}>
        <Stack direction="row" justifyContent="space-between" gap={1}><Typography>{title || 'Операция без названия'}</Typography><Typography sx={{ whiteSpace: 'nowrap' }}>{operation.dataset === 'expenses' ? '−' : '+'}{amount.ok ? amount.value : 'Сумма недоступна'}</Typography></Stack>
        {operation.dataset === 'expenses' && <Typography variant="body2">{operation.facts.category}</Typography>}
        {!readOnly && <Stack direction="row" gap={0.5} flexWrap="wrap">
          <Chip size="small" color={query.isError || decision?.status === 'stale' || decision?.status === 'blocked' ? 'warning' : decision?.status === 'approved' ? 'success' : 'default'} variant={decision?.status === 'explicit_unclassified' ? 'outlined' : 'filled'} label={saved ? 'Сохранено. Актуальность требует проверки' : query.isError ? 'Не удалось загрузить классификацию' : !decision ? 'Загрузка классификации…' : classificationLabel(decision.status)} />
          {decision?.confirmed && <><Chip size="small" variant="outlined" label={roleLabel(decision.confirmed.economicRole)} />{decision.confirmed.layer && <Chip size="small" variant="outlined" label={layerLabel(decision.confirmed.layer)} />}</>}
        </Stack>}
      </Stack>
    </AccordionSummary>
    <AccordionDetails>
      {saved && <Alert severity="success">Классификация сохранена</Alert>}
      {expanded && <Stack spacing={1} component="section" aria-label="Проверка операции">
        <Stack aria-label="Факты выбранной операции">{Object.entries(operation.facts).map(([key,value]) => <Typography key={key} sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{factLabel(key)}: {key === 'date' && typeof value === 'string' ? dateLabel(value) : String(value ?? 'не задано')}</Typography>)}</Stack>
        {!readOnly && (query.isError ? <Alert severity="warning">Не удалось загрузить классификацию. <Button onClick={() => void query.refetch()}>Повторить чтение</Button></Alert> : decision && <>
          {decision.status === 'blocked' ? <Alert severity="warning">Редактирование недоступно</Alert> : <OperationEditor key={query.requestId} operation={operation} scope={scope} decision={decision} onSaved={() => {setSaved(true);onClose();}} onRefresh={() => void query.refetch()} />}
        </>)}
      </Stack>}
    </AccordionDetails>
  </Accordion>;
};

export const HistoricalClassification = ({ period, readOnly = false }: { period: CalendarPeriod; readOnly?: boolean }) => {
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
