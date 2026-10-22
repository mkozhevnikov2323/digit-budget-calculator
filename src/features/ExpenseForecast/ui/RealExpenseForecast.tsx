import { useId, useState } from 'react';
import { skipToken } from '@reduxjs/toolkit/query';
import { Alert, Button, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useVerifiedOwner } from 'entities/User/model/useVerifiedOwner';
import { yearPeriod } from 'features/FinancialAnalytics/model/period';
import { formatKopecks } from 'features/FinancialAnalytics/model/money';
import { FINANCIAL_LAYERS } from 'features/FinancialClassification/model/types';
import type { CoherentHistory } from 'features/HistoricalClassification/model/coherentHistory';
import { useGetCoherentHistoryQuery } from 'features/HistoricalClassification/api/historyApi';
import { forecastExpenses, compareForecastYears, type ExpenseForecast } from '../model/forecast';
import { recordingEvidenceInput } from '../model/recordingEvidence';
import { RecordingEvidenceControls } from './RecordingEvidenceControls';
import { recordedStatistics } from 'features/ClassificationStatistics/model/recordedHistory';
export type RecordedForecastSuggestion = { cohort: CoherentHistory; input: Extract<ReturnType<typeof recordingEvidenceInput>, { ok: true }>['value']; forecast: ExpenseForecast };
const money = (n: number | null) => { const f = n === null ? null : formatKopecks(n); return f?.ok ? f.value : 'Нужна ручная цель'; };

export const RealExpenseForecast = ({ cohort, asOf = Date.now(), onCalculated }: { cohort: CoherentHistory; asOf?: number;
  onCalculated?: (value: RecordedForecastSuggestion | null) => void }) => {
  const [evidence, setEvidence] = useState<{ cohort: CoherentHistory; months: string[] }>({ cohort, months: [] });
  const [adjustment, setAdjustment] = useState('0'), [requested, setRequested] = useState(false);
  const months = evidence.cohort === cohort ? evidence.months : [];
  const input = recordingEvidenceInput(cohort, months, asOf);
  const bps = /^-?\d{1,4}$/.test(adjustment) ? Number(adjustment) * 100 : NaN;
  const result = requested && input.ok ? forecastExpenses(input.value, { asOf, adjustmentBasisPoints: bps }) : null;
  const stats = recordedStatistics(cohort), coverage = stats.ok ? stats.value.expenses.coverage : null;
  const invalidate = () => { setRequested(false); onCalculated?.(null); };
  return <Stack spacing={1} component="section" aria-label="Прогноз по записанной истории">
    <Typography component="h3" variant="h6">Оценка будущих расходов по выбранной истории</Typography>
    <RecordingEvidenceControls cohort={cohort} confirmed={months} asOf={asOf} onChange={next => { invalidate(); setEvidence({ cohort, months: next }); }} />
    <TextField label="Сценарное изменение реального прогноза, целые %" value={adjustment} onChange={e => { invalidate(); setAdjustment(e.target.value); }}
      helperText="От −100 до +1000%. Предположение пользователя, не статистически предсказанная инфляция." />
    <Button onClick={() => {
      setRequested(true);
      const r = input.ok ? forecastExpenses(input.value, { asOf, adjustmentBasisPoints: bps }) : null;
      onCalculated?.(r?.ok && input.ok ? { cohort, input: input.value, forecast: r.value } : null);
    }}>Рассчитать оценку по записанной истории</Button>
    {requested && (!input.ok || !result?.ok) && <Alert severity="warning" role="note">Прогноз недоступен: {result && !result.ok ? result.error.code : 'invalid_recording_evidence'}. Нужны 12 полностью выбранных завершённых месяцев, подтверждённая запись и подтверждённые обычные расходы. Неизвестные суммы не экстраполируются.</Alert>}
    {result?.ok && input.ok && <>
      <Typography>12 подтверждённых месяцев записи. Покрытие классификации: {result.value.classificationCoverage}. По сумме: {coverage?.byAmount == null ? 'нет знаменателя' : `${(coverage.byAmount * 100).toFixed(1)}%`}; по количеству: {coverage?.byCount == null ? 'нет знаменателя' : `${(coverage.byCount * 100).toFixed(1)}%`}. Не покрыто: {money(result.value.uncoveredKopecks)} / {result.value.uncoveredCount} операций.</Typography>
      <Alert severity={result.value.classificationCoverage === 'partial' ? 'warning' : 'info'} role="note">Оценка только подтверждённых компонентов, не полного необходимого бюджета. Займы, переводы и капитал не превращаются в повседневное потребление. Реальная полнота записи подтверждена вами только в этой памяти.</Alert>
      <Table size="small" aria-label="Прогноз по реальным финансовым слоям"><TableHead><TableRow>{['Слой / метод', 'История', 'Среднее/мес', 'Медиана/мес', 'Min–max', 'Размах', 'Тренд двух полугодий', 'Оценка/мес', 'Проекция/год'].map(x => <TableCell key={x}>{x}</TableCell>)}</TableRow></TableHead>
        <TableBody>{FINANCIAL_LAYERS.map(layer => { const s = result.value.layers[layer]; return <TableRow key={layer}>
          <TableCell>{layer} / {s.method}</TableCell><TableCell>{money(s.historicalKopecks)}</TableCell><TableCell>{money(s.meanMonthlyKopecks)}</TableCell><TableCell>{money(s.medianMonthlyKopecks)}</TableCell>
          <TableCell>{money(s.minMonthlyKopecks)} — {money(s.maxMonthlyKopecks)}</TableCell><TableCell>{money(s.variationRangeKopecks)}</TableCell><TableCell>{money(s.recentHalfChangeKopecks)}</TableCell>
          <TableCell>{money(s.monthlyEstimateKopecks)}</TableCell><TableCell>{money(s.projectedAnnualKopecks)}</TableCell></TableRow>; })}</TableBody>
      </Table>
      <Typography>everyday: медиана; irregular/emergency: распределение исторической годовой суммы по месяцам, не предсказание времени событий. Цели и долгосрочный капитал задаются вручную. Исходные деньги не округляются, производные оценки округляются до копейки. Выбросы остаются в истории.</Typography>
      <PreviousYearComparison current={cohort} currentInput={input.value} adjustmentBasisPoints={bps} asOf={asOf} />
    </>}
  </Stack>;
};

const PreviousYearComparison = ({ current, currentInput, adjustmentBasisPoints, asOf }: {
  current: CoherentHistory; currentInput: RecordedForecastSuggestion['input']; adjustmentBasisPoints: number; asOf: number;
}) => {
  const owner = useVerifiedOwner(), instance = useId(), [open, setOpen] = useState(false);
  const year = Number(current.history.period.firstDate.slice(0, 4)), previous = yearPeriod(year - 1);
  const userId = owner.status === 'verified' ? owner.owner.userId : undefined, generation = owner.status === 'verified' ? owner.owner.sessionGeneration : undefined;
  const args = open && previous.ok && userId === current.history.owner && generation ? { userId, sessionGeneration: generation,
    period: previous.value, requestScope: `${instance}/previous/${year}` } : skipToken;
  const query = useGetCoherentHistoryQuery(args, { refetchOnMountOrArgChange: true });
  const candidate = query.currentData;
  const cohort = !query.isFetching && !query.isError && args !== skipToken && candidate && candidate.history.owner === userId
    && candidate.history.period.startInclusive === args.period.startInclusive && candidate.history.period.endExclusive === args.period.endExclusive ? candidate : undefined;
  return <Stack spacing={1}>
    <Button disabled={!previous.ok || !current.history.period.firstDate.endsWith('-01-01') || !current.history.period.lastDate.endsWith('-12-31')}
      onClick={() => setOpen(v => !v)}>Сравнить с предыдущим полным годом</Button>
    {open && (query.isError ? <Alert severity="warning" role="note">Согласованная история предыдущего года недоступна.</Alert> : !cohort
      ? <Typography role="status">Проверка предыдущего года…</Typography>
      : <YearComparisonEvidence key={query.requestId} previous={cohort} currentInput={currentInput} adjustmentBasisPoints={adjustmentBasisPoints} asOf={asOf} />)}
  </Stack>;
};
const YearComparisonEvidence = ({ previous, currentInput, adjustmentBasisPoints, asOf }: { previous: CoherentHistory;
  currentInput: RecordedForecastSuggestion['input']; adjustmentBasisPoints: number; asOf: number }) => {
  // Loading the preceding year completes after the initiating render.
  const comparisonAsOf = Math.max(asOf, Date.now());
  const [confirmed, setConfirmed] = useState<string[]>([]), input = recordingEvidenceInput(previous, confirmed, comparisonAsOf);
  const result = input.ok ? compareForecastYears(currentInput, input.value, { asOf: comparisonAsOf, adjustmentBasisPoints }) : null;
  return <Stack spacing={1}>
    <Typography>Отдельно проверьте запись предыдущего года. Сравниваются только подтверждённые компоненты обоих лет; различия покрытия могут влиять на суммы.</Typography>
    <RecordingEvidenceControls cohort={previous} confirmed={confirmed} onChange={setConfirmed} asOf={comparisonAsOf} />
    {result?.ok ? <Table size="small" aria-label="Изменения подтверждённых расходов между годами"><TableBody>{FINANCIAL_LAYERS.map(layer => <TableRow key={layer}>
      <TableCell>{layer}</TableCell><TableCell>{money(result.value[layer])}</TableCell></TableRow>)}</TableBody></Table>
      : <Typography>Сравнение пока недоступно: нужны сопоставимые полные годы и отдельное подтверждение записи.</Typography>}
  </Stack>;
};
