import { lazy, Suspense, useState } from 'react';
import { Alert, Button, Checkbox, FormControlLabel, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useVerifiedOwner } from 'entities/User/model/useVerifiedOwner';
import { FINANCIAL_LAYERS, type FinancialLayer } from 'features/FinancialClassification/model/types';
import { formatKopecks, rublesToKopecks } from 'features/FinancialAnalytics/model/money';
import { forecastExpenses } from 'features/ExpenseForecast/model/forecast';
import { syntheticHistoryInput } from 'features/ClassificationStatistics/model/synthetic';
import type { CoherentHistory } from 'features/HistoricalClassification/model/coherentHistory';
import type { RecordedForecastSuggestion } from 'features/ExpenseForecast/ui/RealExpenseForecast';
import { planFromRecordedHistory } from '../model/recordedPlan';
import { allocateAnnual, budgetPlanTotals, comparePlanActual, createBudgetPlan, draftFromPlan, exportBudgetPlan,
  importBudgetPlan, planFromDraft, type PlanDraft } from '../model/plan';

const money = (n: number) => { const f = formatKopecks(n); return f.ok ? f.value : 'Недоступно'; };
const decimal = (n: number) => money(n).replace(' ₽', '').replace(',', '.');
const emptyDraft = (): PlanDraft => {
  const now = new Date(Date.now()).getUTCFullYear(), year = Number.isInteger(now) ? Math.max(3, Math.min(9999, now + 1)) : 2027;
  const ref = String(year - 2).padStart(4, '0');
  const p = createBudgetPlan(year, { firstDate: `${ref}-01-01`, lastDate: `${ref}-12-31` }, Object.fromEntries(FINANCIAL_LAYERS.map(l => [l, 0])), 0);
  if (!p.ok) throw Error('Local plan initialization unavailable'); return draftFromPlan(p.value);
};
type Row = FinancialLayer | 'reserve';
const rows: readonly Row[] = [...FINANCIAL_LAYERS, 'reserve'];
type PlanningProps = { cohort?: CoherentHistory; suggestion?: RecordedForecastSuggestion; realMode?: boolean };
const ActualComparison = lazy(() => import('./RecordedPlanActual').then(m => ({ default: m.RecordedPlanActual })));
const PlanningWorkspace = ({ cohort, suggestion, realMode = false }: PlanningProps) => {
  const [draft, setDraft] = useState(emptyDraft), [annual, setAnnual] = useState<Record<Row, string>>(
    () => Object.fromEntries(rows.map(l => [l, '0'])) as Record<Row, string>);
  const [exported, setExported] = useState(''), [imported, setImported] = useState(''), [message, setMessage] = useState('');
  const [showActual, setShowActual] = useState(false);
  const [protectedLayers, setProtectedLayers] = useState<FinancialLayer[]>([]);
  const [reviewedSuggestion, setReviewedSuggestion] = useState<RecordedForecastSuggestion | null>(null), [provenance, setProvenance] = useState('');
  const parsed = planFromDraft(draft), totals = parsed.ok ? budgetPlanTotals(parsed.value) : null;
  const edit = (next: PlanDraft, protectedRow?: Row) => {
    if (protectedRow && protectedRow !== 'reserve') setProtectedLayers(values => values.includes(protectedRow) ? values : [...values, protectedRow]);
    if (next.firstDate !== draft.firstDate || next.lastDate !== draft.lastDate) setProvenance('');
    setDraft(next); setExported(''); setMessage(''); setReviewedSuggestion(null);
  };
  const referenceMatches = cohort && draft.firstDate === cohort.history.period.firstDate && draft.lastDate === cohort.history.period.lastDate;
  const suggestionReviewed = !!suggestion && reviewedSuggestion === suggestion;
  const asOf = Date.parse('2027-03-15T00:00:00Z');
  const fictionalActual = showActual ? { ...syntheticHistoryInput(2027, false), observedAt: asOf } : null;
  const comparison = parsed.ok && fictionalActual ? comparePlanActual(parsed.value, fictionalActual, asOf) : null;
  return <Stack spacing={1} component="section" aria-label="Локальный план бюджета">
    <Alert severity="info" role="note">Несохранённый локальный черновик. Только память этой сессии: закрытие, перезагрузка или смена владельца удаляют план. Автоматического сохранения, загрузки на сервер и создания расходов нет.</Alert>
    {draft.basis === 'synthetic_suggestion' && <Alert severity="warning" role="note">ДЕМО · План основан на вымышленном прогнозе 2025 года, не на вашей истории. Ручные правки не превращают источник в реальный.</Alert>}
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
      <TextField label="Год плана" value={draft.year} onChange={e => edit({ ...draft, year: e.target.value })} />
      <TextField label="Начало исторической базы" type="date" value={draft.firstDate} slotProps={{ inputLabel: { shrink: true } }} onChange={e => edit({ ...draft, firstDate: e.target.value })} />
      <TextField label="Конец исторической базы" type="date" value={draft.lastDate} slotProps={{ inputLabel: { shrink: true } }} onChange={e => edit({ ...draft, lastDate: e.target.value })} />
    </Stack>
    <Typography>Цели — пользовательские суммы, не финансовые операции. Резерв отдельно от расходов; займы и переводы не включаются в бытовое потребление.</Typography>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
      <Button onClick={() => { edit(emptyDraft()); setShowActual(false); setProtectedLayers([]); setProvenance(''); }}>Новый пустой план — удалить текущий черновик</Button>
      {!realMode && <Button onClick={() => {
        const f = forecastExpenses(syntheticHistoryInput(), { asOf: Date.now(), adjustmentBasisPoints: 0 });
        if (!f.ok) { setMessage('Вымышленные рекомендации недоступны. Черновик сохранён.'); return; }
        const p = createBudgetPlan(2027, { firstDate: '2025-01-01', lastDate: '2025-12-31' },
          Object.fromEntries(FINANCIAL_LAYERS.map(l => [l, f.value.layers[l].projectedAnnualKopecks ?? 0])), 0, 'synthetic_suggestion');
        if (p.ok) { edit(draftFromPlan(p.value)); setShowActual(false); }
      }}>Заменить черновик вымышленными рекомендациями на 2027</Button>}
    </Stack>
    {realMode && <Stack spacing={1} component="section" aria-label="Рекомендации из записанной истории">
      {cohort ? <>
        <Typography>Выбранная записанная база: {cohort.history.period.firstDate} — {cohort.history.period.lastDate}. Изменение базы или поступление новых расходов не переписывает суммы плана.</Typography>
        <Button onClick={() => edit({ ...draft, firstDate: cohort.history.period.firstDate, lastDate: cohort.history.period.lastDate })}>Использовать выбранный период как базу без изменения сумм</Button>
      </> : <Typography>Рекомендации недоступны без проверенной истории. Ручное планирование и текущий ввод доступны.</Typography>}
      {suggestion && <Typography>Источник рекомендации: записанная история {suggestion.forecast.referencePeriod.firstDate} — {suggestion.forecast.referencePeriod.lastDate}. Классификация: {suggestion.forecast.classificationCoverage}; сценарий: {suggestion.forecast.adjustmentBasisPoints / 100}%. Непокрытая сумма: {money(suggestion.forecast.uncoveredKopecks)}. Подтверждения записи временные; оценка только подтверждённых компонентов.</Typography>}
      <Typography>Защищённые ручные слои: {protectedLayers.join(', ') || 'нет'}. Ручные изменения, включая нули, сохраняются. Цели, долгосрочный капитал и резерв рекомендациями не заменяются.</Typography>
      <FormControlLabel control={<Checkbox checked={suggestionReviewed} disabled={!suggestion || !referenceMatches || !parsed.ok}
        onChange={e => setReviewedSuggestion(e.target.checked ? suggestion ?? null : null)} />} label="Я проверил(а) рекомендации и ограничения; ручные слои и резерв сохранить" />
      <Button disabled={!suggestionReviewed || !referenceMatches || !parsed.ok} onClick={() => {
        if (!suggestion || !suggestionReviewed || !parsed.ok) return;
        const result = planFromRecordedHistory(parsed.value, suggestion.input, { asOf: Date.now(), adjustmentBasisPoints: suggestion.forecast.adjustmentBasisPoints }, protectedLayers);
        if (!result.ok) { setMessage('Рекомендации неприменимы: проверьте базу, полноту истории и ручной план. Черновик сохранён.'); return; }
        edit(draftFromPlan(result.value)); setProvenance(`Приняты рекомендации по записанной истории ${draft.firstDate} — ${draft.lastDate}; сценарий ${suggestion.forecast.adjustmentBasisPoints / 100}%. Это пользовательские цели, не серверное подтверждение и не расходы.`);
      }}>Применить рекомендации к не изменённым вручную слоям</Button>
      {provenance && <Typography role="status">{provenance}</Typography>}
    </Stack>}
    <Typography variant="body2">Рекомендации необязательны. Для major_goals/long_term_capital и резерва суммы задаются вручную. Новые расходы никогда автоматически не меняют план.</Typography>
    <Table size="small" aria-label="Годовые цели и распределение"><TableHead><TableRow><TableCell>Назначение</TableCell><TableCell>Годовая сумма, ₽</TableCell><TableCell>Действие</TableCell></TableRow></TableHead>
      <TableBody>{rows.map(row => <TableRow key={row}><TableCell>{row === 'reserve' ? 'Резерв (не расход)' : row}</TableCell><TableCell>
        <TextField label={`Новая годовая сумма ${row}`} helperText="Для перераспределения; текущий план — в месячных полях" value={annual[row]} onChange={e => setAnnual(a => ({ ...a, [row]: e.target.value }))} />
      </TableCell><TableCell><Button onClick={() => {
        const n = rublesToKopecks(annual[row]), split = n.ok ? allocateAnnual(n.value) : null;
        if (!split?.ok) { setMessage('Некорректная годовая сумма. Ввод не удалён.'); return; }
        const values = split.value.map(decimal);
        edit(row === 'reserve' ? { ...draft, reserve: values } : { ...draft, layers: { ...draft.layers, [row]: values } }, row);
      }}>Распределить {row} по 12 месяцам</Button></TableCell></TableRow>)}</TableBody>
    </Table>
    <Stack sx={{ overflowX: 'auto' }}><Table size="small" aria-label="Месячные цели бюджета"><TableHead><TableRow><TableCell>Месяц</TableCell>{rows.map(row => <TableCell key={row}>{row}</TableCell>)}</TableRow></TableHead>
      <TableBody>{Array.from({ length: 12 }, (_, i) => <TableRow key={i}><TableCell>{i + 1}</TableCell>{rows.map(row => <TableCell key={row}>
        <TextField size="small" sx={{ minWidth: 110 }} label={`${row} месяц ${i + 1}`} value={row === 'reserve' ? draft.reserve[i] : draft.layers[row][i]} onChange={e => {
          const values = [...(row === 'reserve' ? draft.reserve : draft.layers[row])]; values[i] = e.target.value;
          edit(row === 'reserve' ? { ...draft, reserve: values } : { ...draft, layers: { ...draft.layers, [row]: values } }, row);
        }} />
      </TableCell>)}</TableRow>)}</TableBody>
    </Table></Stack>
    {totals?.ok ? <Typography role="status">Годовые цели расходов: {money(totals.value.expenseTargetsKopecks)}. Резерв отдельно: {money(totals.value.reserveAllocationKopecks)}. Общая плановая потребность: {money(totals.value.resourceAllocationKopecks)}.</Typography>
      : <Alert severity="error">Итоги недоступны: проверьте год, историческую базу и суммы без округления. Ввод сохранён.</Alert>}
    <Button disabled={!parsed.ok} onClick={() => { if (parsed.ok) { const r = exportBudgetPlan(parsed.value); if (r.ok) setExported(r.value); } }}>Экспортировать JSON по запросу</Button>
    {exported && <TextField label="Экспорт JSON — скопируйте явно" multiline minRows={3} value={exported} slotProps={{ input: { readOnly: true } }} />}
    <TextField label="JSON для импорта" multiline minRows={2} value={imported} slotProps={{ htmlInput: { maxLength: 65536 } }} onChange={e => setImported(e.target.value)} />
    <Button onClick={() => { const r = importBudgetPlan(imported); if (r.ok) { edit(draftFromPlan(r.value)); setProtectedLayers([...FINANCIAL_LAYERS]); setProvenance(''); setMessage('План импортирован только в память.'); }
      else setMessage('Импорт отклонён. Текущий черновик и исходный текст сохранены.'); }}>Импортировать JSON — заменить черновик</Button>
    {message && <Typography role="status">{message}</Typography>}
    {realMode && parsed.ok ? <Suspense fallback={<Typography role="status">Загрузка сравнения…</Typography>}><ActualComparison plan={parsed.value} /></Suspense>
      : !realMode && <Alert severity="info" role="note">Реальное сравнение доступно в разделе записанной истории. Неполный месяц не считается завершённым.</Alert>}
    {!realMode && <Button onClick={() => setShowActual(v => !v)}>Показать вымышленный факт за январь–февраль 2027</Button>}
    {!realMode && showActual && <>
      <Alert severity="warning" role="note">ДЕМО · Факт вымышленный, дата наблюдения 15 марта 2027. Март исключён. Это не реальные расходы.</Alert>
      {comparison?.ok ? <Typography>Завершённых месяцев: {comparison.value.elapsedMonths}. Цель: {money(comparison.value.plannedElapsedKopecks)}. Вымышленный факт: {money(comparison.value.actualElapsedKopecks)}. Отклонение (факт − цель): {money(comparison.value.varianceKopecks)}. Осталось по расписанию: {money(comparison.value.remainingScheduledKopecks)}. Остаток годовой цели после факта: {money(comparison.value.remainingAgainstAnnualTargetKopecks)}.</Typography>
        : <Typography>Сравнение недоступно: нужен корректный план на 2027 и полная классифицированная история.</Typography>}
    </>}
  </Stack>;
};

export const BudgetPlanning = ({ cohort, suggestion, realMode = false }: PlanningProps = {}) => {
  const owner = useVerifiedOwner(), [open, setOpen] = useState(false);
  const currentCohort = owner.status === 'verified' && cohort?.history.owner === owner.owner.userId ? cohort : undefined;
  const currentSuggestion = currentCohort && suggestion?.cohort === currentCohort ? suggestion : undefined;
  return <Stack spacing={1}>
    <Typography component="h2" variant="h6">Локальное планирование бюджета</Typography>
    <Button onClick={() => setOpen(v => !v)}>{open ? 'Закрыть и удалить локальный черновик' : 'Открыть локальный план'}</Button>
    {open && (owner.status === 'verified' ? <PlanningWorkspace key={`${owner.owner.userId}/${owner.owner.sessionGeneration}`} cohort={currentCohort} suggestion={currentSuggestion} realMode={realMode} />
      : <Alert severity="info" role="note">Нужна текущая проверка владельца. Предыдущий черновик удалён.</Alert>)}
  </Stack>;
};
