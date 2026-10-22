import { useId, useMemo, useState } from 'react';
import { skipToken } from '@reduxjs/toolkit/query';
import { Alert, Button, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useVerifiedOwner } from 'entities/User/model/useVerifiedOwner';
import type { CalendarPeriod } from 'features/FinancialAnalytics/model/period';
import { formatKopecks } from 'features/FinancialAnalytics/model/money';
import { FINANCIAL_LAYERS } from 'features/FinancialClassification/model/types';
import { useGetCoherentHistoryQuery } from 'features/HistoricalClassification/api/historyApi';
import type { CoherentHistory } from 'features/HistoricalClassification/model/coherentHistory';
import { recordedCategories, recordedStatistics } from '../model/recordedHistory';
import { STATUSES } from '../model/statistics';
import { RealExpenseForecast } from 'features/ExpenseForecast/ui/RealExpenseForecast';
const money = (n: number) => { const f = formatKopecks(n); return f.ok ? f.value : 'Недоступно'; };
const percent = (n: number | null) => n === null ? 'нет знаменателя' : `${(n * 100).toFixed(1)}%`;

export const RecordedStatisticsReport = ({ cohort }: { cohort: CoherentHistory }) => {
  const result = recordedStatistics(cohort), categories = recordedCategories(cohort);
  if (!result.ok || !categories) return <Alert severity="error">Проверка сверки не пройдена. Реальные итоги не рассчитаны.</Alert>;
  const stats = result.value;
  return <Stack spacing={1} aria-label="Реальная статистика классификации">
    <Typography component="h3" variant="h6">Классификация записанной истории</Typography>
    <Alert severity="info" role="note">Полный ответ по записанным операциям проверен. Это неатомарные наблюдения, не снимок БД. Полнота классификации и полнота записи реальных расходов — отдельные свойства. Категория не назначает слой.</Alert>
    {(['expenses', 'incomes'] as const).map(dataset => {
      const d = stats[dataset];
      return <Stack key={dataset} spacing={1} component="section" aria-label={`Классификация ${dataset}`}>
        <Typography component="h4">{dataset === 'expenses' ? 'Записанные расходы' : 'Записанные поступления'}: {money(d.recorded.kopecks)} · {d.recorded.count} операций.</Typography>
        <Typography>Покрытие классификации по количеству: {percent(d.coverage.byCount)}; по сумме: {percent(d.coverage.byAmount)}.</Typography>
        <Table size="small" aria-label={`Статусы и роли ${dataset}`}><TableHead><TableRow><TableCell>Группа</TableCell><TableCell>Сумма</TableCell><TableCell>Операций</TableCell></TableRow></TableHead>
          <TableBody>{STATUSES.map(status => <TableRow key={status}><TableCell>{status}</TableCell><TableCell>{money(d.statuses[status].kopecks)}</TableCell><TableCell>{d.statuses[status].count}</TableCell></TableRow>)}
            {Object.entries(d.roles).map(([role, bucket]) => <TableRow key={role}><TableCell>Роль: {role}</TableCell><TableCell>{money(bucket.kopecks)}</TableCell><TableCell>{bucket.count}</TableCell></TableRow>)}</TableBody>
        </Table>
      </Stack>;
    })}
    <Typography>Слои включают только подтверждённые ordinary_expense. Займы, переводы, возвраты и капитал остаются в своих ролях. Статусы и роли — разные представления одних сумм, они не складываются.</Typography>
    <Table size="small" aria-label="Реальные финансовые слои"><TableHead><TableRow><TableCell>Слой</TableCell><TableCell>Сумма</TableCell><TableCell>Операций</TableCell></TableRow></TableHead>
      <TableBody>{FINANCIAL_LAYERS.map(layer => <TableRow key={layer}><TableCell>{layer}</TableCell><TableCell>{money(stats.expenses.layers[layer].kopecks)}</TableCell><TableCell>{stats.expenses.layers[layer].count}</TableCell></TableRow>)}</TableBody>
    </Table>
    <Table size="small" aria-label="Реальные категории независимо от слоёв"><TableHead><TableRow><TableCell>Категория (точная строка)</TableCell><TableCell>Сумма</TableCell><TableCell>Операций</TableCell></TableRow></TableHead>
      <TableBody>{categories.map(c => <TableRow key={c.category}><TableCell sx={{ whiteSpace: 'pre-wrap' }}>{c.category || '(пустая строка)'}</TableCell><TableCell>{money(c.kopecks)}</TableCell><TableCell>{c.count}</TableCell></TableRow>)}</TableBody>
    </Table>
    <Table size="small" aria-label="Реальная месячная классификация"><TableHead><TableRow>{['Месяц UTC', 'Расходы', 'Поступления', 'Классифицированные расходы', ...FINANCIAL_LAYERS].map(x => <TableCell key={x}>{x}</TableCell>)}</TableRow></TableHead>
      <TableBody>{stats.months.map(m => <TableRow key={m.key}><TableCell>{m.key} · {m.calendar}</TableCell><TableCell>{money(m.expenses.recorded.kopecks)}</TableCell><TableCell>{money(m.incomes.recorded.kopecks)}</TableCell><TableCell>{money(m.expenses.statuses.approved.kopecks)}</TableCell>
        {FINANCIAL_LAYERS.map(layer => <TableCell key={layer}>{money(m.expenses.layers[layer].kopecks)}</TableCell>)}</TableRow>)}</TableBody>
    </Table>
    {!stats.expenses.recorded.count && !stats.incomes.recorded.count && <Typography>Записанных операций нет. Это не подтверждение нулевых реальных расходов.</Typography>}
  </Stack>;
};

export const RealClassificationStatistics = ({ period }: { period: CalendarPeriod }) => {
  const owner = useVerifiedOwner(), instance = useId(), [open, setOpen] = useState(false);
  const userId = owner.status === 'verified' ? owner.owner.userId : undefined;
  const generation = owner.status === 'verified' ? owner.owner.sessionGeneration : undefined;
  const args = useMemo(() => open && userId && generation ? { userId, sessionGeneration: generation, period,
    requestScope: `${instance}/${period.startInclusive}/${period.endExclusive}` } : skipToken, [open, userId, generation, period, instance]);
  const query = useGetCoherentHistoryQuery(args, { refetchOnMountOrArgChange: true });
  const cohort = open && owner.status === 'verified' && args !== skipToken && !query.isFetching && !query.isError ? query.currentData : undefined;
  return <Stack spacing={1} component="section" aria-label="Анализ реальной классифицированной истории">
    <Typography component="h2" variant="h6">Историческая статистика по классификации</Typography>
    <Button onClick={() => setOpen(v => !v)}>{open ? 'Закрыть реальную статистику' : 'Загрузить реальную статистику классификации'}</Button>
    {open && (owner.status !== 'verified' ? <Alert severity="info" role="note">Нужна текущая проверка владельца.</Alert>
      : query.isError ? <Alert severity="warning" role="note">Полный когерентный источник недоступен или изменился. Проверьте доступность нового backend read gate; частичные итоги не показаны.</Alert>
        : !cohort ? <Typography role="status">Проверка всей записанной истории и состава периода…</Typography>
          : <Stack key={query.requestId}><RecordedStatisticsReport cohort={cohort} /><RealExpenseForecast cohort={cohort} /></Stack>)}
    {open && owner.status === 'verified' && <Button onClick={() => void query.refetch()}>Заново проверить состав и факты периода</Button>}
  </Stack>;
};
