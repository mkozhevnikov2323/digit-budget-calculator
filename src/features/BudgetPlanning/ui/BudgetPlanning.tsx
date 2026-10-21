import { useState } from 'react';
import { Alert, Button, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useVerifiedOwner } from 'entities/User/model/useVerifiedOwner';
import { FINANCIAL_LAYERS, type FinancialLayer } from 'features/FinancialClassification/model/types';
import { formatKopecks, rublesToKopecks } from 'features/FinancialAnalytics/model/money';
import { forecastExpenses } from 'features/ExpenseForecast/model/forecast';
import { syntheticHistoryInput } from 'features/ClassificationStatistics/model/synthetic';
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
const PlanningWorkspace = () => {
  const [draft, setDraft] = useState(emptyDraft), [annual, setAnnual] = useState<Record<Row, string>>(
    () => Object.fromEntries(rows.map(l => [l, '0'])) as Record<Row, string>);
  const [exported, setExported] = useState(''), [imported, setImported] = useState(''), [message, setMessage] = useState('');
  const [showActual, setShowActual] = useState(false);
  const parsed = planFromDraft(draft), totals = parsed.ok ? budgetPlanTotals(parsed.value) : null;
  const edit = (next: PlanDraft) => { setDraft(next); setExported(''); setMessage(''); };
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
      <Button onClick={() => { edit(emptyDraft()); setShowActual(false); }}>Новый пустой план — удалить текущий черновик</Button>
      <Button onClick={() => {
        const f = forecastExpenses(syntheticHistoryInput(), { asOf: Date.now(), adjustmentBasisPoints: 0 });
        if (!f.ok) { setMessage('Вымышленные рекомендации недоступны. Черновик сохранён.'); return; }
        const p = createBudgetPlan(2027, { firstDate: '2025-01-01', lastDate: '2025-12-31' },
          Object.fromEntries(FINANCIAL_LAYERS.map(l => [l, f.value.layers[l].projectedAnnualKopecks ?? 0])), 0, 'synthetic_suggestion');
        if (p.ok) { edit(draftFromPlan(p.value)); setShowActual(false); }
      }}>Заменить черновик вымышленными рекомендациями на 2027</Button>
    </Stack>
    <Typography variant="body2">Рекомендации необязательны. Для major_goals/long_term_capital и резерва суммы задаются вручную. Новые расходы никогда автоматически не меняют план.</Typography>
    <Table size="small" aria-label="Годовые цели и распределение"><TableHead><TableRow><TableCell>Назначение</TableCell><TableCell>Годовая сумма, ₽</TableCell><TableCell>Действие</TableCell></TableRow></TableHead>
      <TableBody>{rows.map(row => <TableRow key={row}><TableCell>{row === 'reserve' ? 'Резерв (не расход)' : row}</TableCell><TableCell>
        <TextField label={`Новая годовая сумма ${row}`} helperText="Для перераспределения; текущий план — в месячных полях" value={annual[row]} onChange={e => setAnnual(a => ({ ...a, [row]: e.target.value }))} />
      </TableCell><TableCell><Button onClick={() => {
        const n = rublesToKopecks(annual[row]), split = n.ok ? allocateAnnual(n.value) : null;
        if (!split?.ok) { setMessage('Некорректная годовая сумма. Ввод не удалён.'); return; }
        const values = split.value.map(decimal);
        edit(row === 'reserve' ? { ...draft, reserve: values } : { ...draft, layers: { ...draft.layers, [row]: values } });
      }}>Распределить {row} по 12 месяцам</Button></TableCell></TableRow>)}</TableBody>
    </Table>
    <Stack sx={{ overflowX: 'auto' }}><Table size="small" aria-label="Месячные цели бюджета"><TableHead><TableRow><TableCell>Месяц</TableCell>{rows.map(row => <TableCell key={row}>{row}</TableCell>)}</TableRow></TableHead>
      <TableBody>{Array.from({ length: 12 }, (_, i) => <TableRow key={i}><TableCell>{i + 1}</TableCell>{rows.map(row => <TableCell key={row}>
        <TextField size="small" sx={{ minWidth: 110 }} label={`${row} месяц ${i + 1}`} value={row === 'reserve' ? draft.reserve[i] : draft.layers[row][i]} onChange={e => {
          const values = [...(row === 'reserve' ? draft.reserve : draft.layers[row])]; values[i] = e.target.value;
          edit(row === 'reserve' ? { ...draft, reserve: values } : { ...draft, layers: { ...draft.layers, [row]: values } });
        }} />
      </TableCell>)}</TableRow>)}</TableBody>
    </Table></Stack>
    {totals?.ok ? <Typography role="status">Годовые цели расходов: {money(totals.value.expenseTargetsKopecks)}. Резерв отдельно: {money(totals.value.reserveAllocationKopecks)}. Общая плановая потребность: {money(totals.value.resourceAllocationKopecks)}.</Typography>
      : <Alert severity="error">Итоги недоступны: проверьте год, историческую базу и суммы без округления. Ввод сохранён.</Alert>}
    <Button disabled={!parsed.ok} onClick={() => { if (parsed.ok) { const r = exportBudgetPlan(parsed.value); if (r.ok) setExported(r.value); } }}>Экспортировать JSON по запросу</Button>
    {exported && <TextField label="Экспорт JSON — скопируйте явно" multiline minRows={3} value={exported} slotProps={{ input: { readOnly: true } }} />}
    <TextField label="JSON для импорта" multiline minRows={2} value={imported} slotProps={{ htmlInput: { maxLength: 65536 } }} onChange={e => setImported(e.target.value)} />
    <Button onClick={() => { const r = importBudgetPlan(imported); if (r.ok) { edit(draftFromPlan(r.value)); setMessage('План импортирован только в память.'); }
      else setMessage('Импорт отклонён. Текущий черновик и исходный текст сохранены.'); }}>Импортировать JSON — заменить черновик</Button>
    {message && <Typography role="status">{message}</Typography>}
    <Alert severity="info" role="note">Реальное сравнение с фактом недоступно до согласованного полного классифицированного источника. Неполный месяц не считается завершённым.</Alert>
    <Button onClick={() => setShowActual(v => !v)}>Показать вымышленный факт за январь–февраль 2027</Button>
    {showActual && <>
      <Alert severity="warning" role="note">ДЕМО · Факт вымышленный, дата наблюдения 15 марта 2027. Март исключён. Это не реальные расходы.</Alert>
      {comparison?.ok ? <Typography>Завершённых месяцев: {comparison.value.elapsedMonths}. Цель: {money(comparison.value.plannedElapsedKopecks)}. Вымышленный факт: {money(comparison.value.actualElapsedKopecks)}. Отклонение (факт − цель): {money(comparison.value.varianceKopecks)}. Осталось по расписанию: {money(comparison.value.remainingScheduledKopecks)}. Остаток годовой цели после факта: {money(comparison.value.remainingAgainstAnnualTargetKopecks)}.</Typography>
        : <Typography>Сравнение недоступно: нужен корректный план на 2027 и полная классифицированная история.</Typography>}
    </>}
  </Stack>;
};

export const BudgetPlanning = () => {
  const owner = useVerifiedOwner(), [open, setOpen] = useState(false);
  return <Stack spacing={1}>
    <Typography component="h2" variant="h6">Локальное планирование бюджета</Typography>
    <Button onClick={() => setOpen(v => !v)}>{open ? 'Закрыть и удалить локальный черновик' : 'Открыть локальный план'}</Button>
    {open && (owner.status === 'verified' ? <PlanningWorkspace key={`${owner.owner.userId}/${owner.owner.sessionGeneration}`} />
      : <Alert severity="info" role="note">Нужна текущая проверка владельца. Предыдущий черновик удалён.</Alert>)}
  </Stack>;
};
