import { useId, useState } from 'react';
import { skipToken } from '@reduxjs/toolkit/query';
import { Alert, Button, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useVerifiedOwner } from 'entities/User/model/useVerifiedOwner';
import { yearPeriod, monthPeriod } from 'features/FinancialAnalytics/model/period';
import { formatKopecks } from 'features/FinancialAnalytics/model/money';
import { FINANCIAL_LAYERS } from 'features/FinancialClassification/model/types';
import { useGetCoherentHistoryQuery } from 'features/HistoricalClassification/api/historyApi';
import type { CoherentHistory } from 'features/HistoricalClassification/model/coherentHistory';
import { RecordingEvidenceControls } from 'features/ExpenseForecast/ui/RecordingEvidenceControls';
import { recordingEvidenceInput } from 'features/ExpenseForecast/model/recordingEvidence';
import { comparePlanActual, type BudgetPlan } from '../model/plan';
const money = (n: number) => { const f = formatKopecks(n); return f.ok ? f.value : 'Недоступно'; };

export const RecordedPlanActual = ({ plan, asOf = Date.now() }: { plan: BudgetPlan; asOf?: number }) => {
  const owner = useVerifiedOwner(), instance = useId(), [open, setOpen] = useState(false);
  const period = yearPeriod(plan.year), firstMonth = monthPeriod(plan.year, 1);
  const hasElapsed = firstMonth.ok && firstMonth.value.endExclusive <= asOf;
  const args = open && hasElapsed && period.ok && plan.basis === 'manual' && owner.status === 'verified'
    ? { userId: owner.owner.userId, sessionGeneration: owner.owner.sessionGeneration, period: period.value, requestScope: `${instance}/actual/${plan.year}` } : skipToken;
  const query = useGetCoherentHistoryQuery(args, { refetchOnMountOrArgChange: true });
  const candidate = query.currentData;
  const cohort = args !== skipToken && !query.isFetching && !query.isError && candidate && candidate.history.owner === args.userId
    && candidate.history.period.startInclusive === args.period.startInclusive && candidate.history.period.endExclusive === args.period.endExclusive ? candidate : undefined;
  return <Stack spacing={1} component="section" aria-label="Сравнение с реальными расходами">
    <Button disabled={!hasElapsed || plan.basis !== 'manual' || owner.status !== 'verified'} onClick={() => setOpen(v => !v)}>Загрузить реальные расходы года плана</Button>
    {!hasElapsed && <Typography>У этого года ещё нет завершённых месяцев. Будущие расходы не считаются нулевым фактом.</Typography>}
    {plan.basis !== 'manual' && <Alert severity="warning" role="note">Вымышленный план не смешивается с реальным сравнением. Создайте ручной план.</Alert>}
    {open && args !== skipToken && (query.isError ? <Alert severity="warning" role="note">Факт недоступен. План и ручной ввод сохранены; частичное сравнение не показано.</Alert>
      : !cohort ? <Typography role="status">Проверка полного состава реальных операций года…</Typography>
        : <ActualEvidence key={query.requestId} cohort={cohort} plan={plan} asOf={Math.max(asOf, Date.now())} />)}
    {open && args !== skipToken && <Button onClick={() => void query.refetch()}>Обновить реальные расходы без изменения плана</Button>}
  </Stack>;
};
const ActualEvidence = ({ cohort, plan, asOf }: { cohort: CoherentHistory; plan: BudgetPlan; asOf: number }) => {
  const [confirmed, setConfirmed] = useState<string[]>([]), input = recordingEvidenceInput(cohort, confirmed, asOf);
  const result = input.ok ? comparePlanActual(plan, input.value, asOf) : null;
  return <Stack spacing={1}>
    <RecordingEvidenceControls cohort={cohort} confirmed={confirmed} onChange={setConfirmed} asOf={asOf} />
    {result?.ok ? <>
      <Typography>Завершённых месяцев: {result.value.elapsedMonths}. План: {money(result.value.plannedElapsedKopecks)}. Реальный подтверждённый факт: {money(result.value.actualElapsedKopecks)}. Отклонение (факт − план): {money(result.value.varianceKopecks)}. Осталось по расписанию: {money(result.value.remainingScheduledKopecks)}. Остаток годовой цели после факта: {money(result.value.remainingAgainstAnnualTargetKopecks)}.</Typography>
      <Table size="small" aria-label="Реальный план и факт по слоям"><TableHead><TableRow>{['Слой', 'План', 'Факт', 'Отклонение'].map(x => <TableCell key={x}>{x}</TableCell>)}</TableRow></TableHead>
        <TableBody>{FINANCIAL_LAYERS.map(layer => <TableRow key={layer}><TableCell>{layer}</TableCell><TableCell>{money(result.value.layers[layer].plannedKopecks)}</TableCell>
          <TableCell>{money(result.value.layers[layer].actualKopecks)}</TableCell><TableCell>{money(result.value.layers[layer].varianceKopecks)}</TableCell></TableRow>)}</TableBody>
      </Table>
      <Typography>Резерв, займы, переводы и прочие непотребительские роли не входят в факт потребления. Текущие и будущие месяцы исключены. Записи и классификации после наблюдения могут измениться.</Typography>
    </> : <Typography>Полное сравнение недоступно: подтвердите запись завершённых месяцев и классифицируйте все расходы этих месяцев. Неизвестные суммы не подменяются нулями.</Typography>}
  </Stack>;
};
