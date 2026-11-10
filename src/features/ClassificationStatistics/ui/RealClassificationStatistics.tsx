import { useAnalyticsState } from 'features/AnalyticsState/model/useAnalyticsState';
import { layerLabel } from 'shared/lib/analytics/presentation';
import {lazy,Suspense, useId, useMemo, useState } from 'react';
import { skipToken } from '@reduxjs/toolkit/query';
import { Alert, Button, CircularProgress, Paper, Stack, Table, TableContainer, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useVerifiedOwner } from 'entities/User/model/useVerifiedOwner';
import type { CalendarPeriod } from 'features/FinancialAnalytics/model/period';
import { useGetCoherentHistoryQuery } from 'features/HistoricalClassification/api/historyApi';
import type { CoherentHistory } from 'features/HistoricalClassification/model/coherentHistory';
import { recordedReport } from '../model/recordedHistory';
import { RealExpenseForecast, type RecordedForecastSuggestion } from 'features/ExpenseForecast/ui/RealExpenseForecast';
import { BudgetPlanning } from 'features/BudgetPlanning/ui/BudgetPlanning';
import {money,percent} from './format';
import {ExpenseDistributionCharts} from './ExpenseDistributionCharts';
const groupLabel=(group:string)=>group==='other'?'Прочие расходы / без группы':group==='mixed'?'Смешанный тип расходов':layerLabel(group);

export const RecordedStatisticsReport = ({ cohort, onRetry }: { cohort: CoherentHistory; onRetry?:()=>void }) => {
  const { result, distribution } = useMemo(() => recordedReport(cohort), [cohort]);
  if (!result.ok || !distribution) return <Stack><Alert severity="error">Не удалось загрузить статистику</Alert>{onRetry&&<Button onClick={onRetry}>Повторить</Button>}</Stack>;
  const stats = result.value;
  return <Stack spacing={1} aria-label="Реальная статистика классификации">
    <Stack direction={{xs:'column',sm:'row'}} spacing={2}>
    {(['expenses', 'incomes'] as const).map(dataset => {
      const d = stats[dataset], expense=dataset==='expenses';
      return <Paper key={dataset} component="section" aria-label={expense?'Расходы':'Доходы'} variant="outlined" sx={{p:2,flex:1}}>
        <Typography component="h2" variant="h6">{expense?'Расходы':'Доходы'}</Typography>
        <Typography>{expense?'Общая сумма расходов':'Общая сумма доходов'}: {money(d.recorded.kopecks)}</Typography>
        <Typography>Количество операций: {d.recorded.count}</Typography>
        <Typography>Классифицировано по количеству: {percent(d.coverage.byCount)}</Typography>
        <Typography>Классифицировано по сумме: {percent(d.coverage.byAmount)}</Typography>
      </Paper>;
    })}
    </Stack>
    <Typography component="h2" variant="h6">Группы расходов</Typography>
    <ExpenseDistributionCharts title="Группы расходов" count={stats.expenses.recorded.count} rows={distribution.groups.map(g=>({...g,label:groupLabel(g.group)}))}/>
    <TableContainer><Table size="small" aria-label="Группы расходов"><TableHead><TableRow>{['Группа','Сумма','Доля суммы, %','Операций','Доля операций, %'].map(label=><TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
      <TableBody>{distribution.groups.map(g=><TableRow key={g.group}><TableCell>{groupLabel(g.group)}</TableCell><TableCell>{money(g.kopecks)}</TableCell><TableCell>{percent(g.amountShare)}</TableCell><TableCell>{g.count}</TableCell><TableCell>{percent(g.countShare)}</TableCell></TableRow>)}</TableBody>
    </Table></TableContainer>
    <Typography component="h2" variant="h6">Расходы по категориям</Typography>
    <ExpenseDistributionCharts title="Расходы по категориям" count={stats.expenses.recorded.count} rows={distribution.categories.map(c=>({...c,label:c.category||'Без названия категории'}))}/>
    <TableContainer><Table size="small" aria-label="Расходы по категориям"><TableHead><TableRow>{['Категория','Тип расходов','Сумма','Доля суммы, %','Операций','Доля операций, %'].map(label=><TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
      <TableBody>{distribution.categories.map(c=><TableRow key={c.category}><TableCell sx={{whiteSpace:'pre-wrap'}}>{c.category||'Без названия категории'}</TableCell><TableCell>{groupLabel(c.group)}</TableCell><TableCell>{money(c.kopecks)}</TableCell><TableCell>{percent(c.amountShare)}</TableCell><TableCell>{c.count}</TableCell><TableCell>{percent(c.countShare)}</TableCell></TableRow>)}</TableBody>
    </Table></TableContainer>
    {!stats.expenses.recorded.count && !stats.incomes.recorded.count && <Typography>За выбранный период операций нет.</Typography>}
  </Stack>;
};

import {classificationGroupsV3Enabled} from 'shared/config/classificationGroups';
const GroupStatistics=lazy(()=>import('features/ClassificationGroups/ui/Statistics'));
export const RealClassificationStatistics = ({period,mode='statistics'}:{period:CalendarPeriod|null;mode?:'statistics'|'planning'})=>classificationGroupsV3Enabled?<Suspense fallback={<Typography>Загрузка статистики…</Typography>}><GroupStatistics period={period} mode={mode}/></Suspense>:<LegacyRealClassificationStatistics period={period} mode={mode}/>;
const LegacyRealClassificationStatistics = ({ period, mode = 'statistics' }: { period: CalendarPeriod | null; mode?:'statistics'|'planning' }) => {
  const owner = useVerifiedOwner(), instance = useId(), [open, setOpen] = useAnalyticsState('historyOpen',false);
  const [suggestion, setSuggestion] = useState<RecordedForecastSuggestion | null>(null);
  const userId = owner.status === 'verified' ? owner.owner.userId : undefined;
  const generation = owner.status === 'verified' ? owner.owner.sessionGeneration : undefined;
  const enabled=mode==='statistics'||open;
  const args = useMemo(() => enabled && userId && generation && period ? { userId, sessionGeneration: generation, period,
    requestScope: `${instance}/${period.startInclusive}/${period.endExclusive}` } : skipToken, [enabled, userId, generation, period, instance]);
  const query = useGetCoherentHistoryQuery(args, { refetchOnMountOrArgChange: true });
  const candidate = query.currentData;
  const cohort = enabled && owner.status === 'verified' && args !== skipToken && !query.isFetching && !query.isError
    && period && candidate && candidate.history.owner === userId && candidate.history.period.startInclusive === period.startInclusive
    && candidate.history.period.endExclusive === period.endExclusive ? candidate : undefined;
  if(mode==='statistics')return <Stack spacing={2} component="section" aria-label="Анализ реальной классифицированной истории">
    {!period?<Alert severity="info">Выберите корректный период.</Alert>
     :owner.status!=='verified'?<Typography role="status">Проверка пользователя…</Typography>
     :query.isError?<Stack><Alert severity="error">Не удалось загрузить статистику</Alert><Button onClick={()=>void query.refetch()}>Повторить</Button></Stack>
     :!cohort?<Stack direction="row" spacing={1} alignItems="center" role="status"><CircularProgress size={20} aria-label="Загрузка статистики"/><Typography>Загрузка статистики…</Typography></Stack>
     :<RecordedStatisticsReport key={query.requestId} cohort={cohort} onRetry={()=>void query.refetch()}/>}
  </Stack>;
  return <Stack spacing={1} component="section" aria-label="Анализ реальной классифицированной истории">
    <Typography component="h2" variant="h6">Историческая база для прогнозирования</Typography>
    <Button disabled={!period} onClick={() => setOpen(v => !v)}>{open ? 'Закрыть реальную статистику' : 'Загрузить реальную статистику классификации'}</Button>
    {open && (!period ? <Alert severity="info" role="note">Укажите корректный период. Черновик плана сохранён.</Alert>
      : owner.status !== 'verified' ? <Alert severity="info" role="note">Нужна текущая проверка владельца.</Alert>
      : query.isError ? <Alert severity="warning" role="note">Полный когерентный источник недоступен или изменился. Проверьте доступность нового серверного чтения; частичные итоги не показаны.</Alert>
        : !cohort ? <Typography role="status">Проверка всей записанной истории и состава периода…</Typography>
          : <Stack key={query.requestId}><RealExpenseForecast cohort={cohort} onCalculated={setSuggestion} /></Stack>)}
    {open && period && owner.status === 'verified' && <Button onClick={() => void query.refetch()}>Заново проверить состав и факты периода</Button>}
    <BudgetPlanning realMode cohort={cohort} suggestion={suggestion?.cohort === cohort ? suggestion ?? undefined : undefined} />
  </Stack>;
};
