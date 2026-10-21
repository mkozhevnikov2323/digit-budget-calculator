import { useState } from 'react';
import { Alert, Button, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { formatKopecks } from 'features/FinancialAnalytics/model/money';
import { FINANCIAL_LAYERS } from 'features/FinancialClassification/model/types';
import { syntheticHistoryInput } from 'features/ClassificationStatistics/model/synthetic';
import { forecastExpenses } from '../model/forecast';
const money = (n: number | null) => { const f = n === null ? null : formatKopecks(n); return f?.ok ? f.value : 'Нужна цель пользователя'; };
export const ExpenseForecast = () => {
  const [demo, setDemo] = useState(false), [adjustment, setAdjustment] = useState('0');
  const valid = /^-?\d{1,4}$/.test(adjustment);
  const result = demo ? forecastExpenses(syntheticHistoryInput(), { asOf: Date.now(), adjustmentBasisPoints: valid ? Number(adjustment) * 100 : NaN }) : null;
  return <Stack spacing={1} component="section" aria-label="Историческая оценка расходов">
    <Typography component="h2" variant="h6">Оценка будущих расходов</Typography>
    <Alert severity="info" role="note">Реальный прогноз недоступен без полного согласованного классифицированного источника и подтверждённой полноты записи месяцев.</Alert>
    <Button onClick={() => setDemo(v => !v)}>{demo ? 'Закрыть вымышленный прогноз' : 'Показать вымышленный прогноз'}</Button>
    {demo && <>
      <Alert severity="warning">ДЕМО · Вымышленная история 2025 года, не ваши данные. Оценка только подтверждённых компонентов, не полный бюджет.</Alert>
      <TextField label="Сценарное изменение, целые %" value={adjustment} onChange={e => setAdjustment(e.target.value)} helperText="От −100 до +1000%. Это предположение пользователя, не статистический прогноз." />
      {result?.ok ? <>
        <Typography>12 полных вымышленных месяцев. Классификация: {result.value.classificationCoverage}. Не покрыто: {money(result.value.uncoveredKopecks)} / {result.value.uncoveredCount} операций.</Typography>
        <Table size="small" aria-label="Вымышленные оценки по слоям"><TableHead><TableRow>{['Слой', 'Среднее/мес', 'Медиана/мес', 'Min–max/мес', 'Оценка/мес', 'Проекция 12 мес'].map(t => <TableCell key={t}>{t}</TableCell>)}</TableRow></TableHead>
          <TableBody>{FINANCIAL_LAYERS.map(l => { const s = result.value.layers[l]; return <TableRow key={l}><TableCell>{l} · {s.method}</TableCell><TableCell>{money(s.meanMonthlyKopecks)}</TableCell><TableCell>{money(s.medianMonthlyKopecks)}</TableCell><TableCell>{money(s.minMonthlyKopecks)} — {money(s.maxMonthlyKopecks)}</TableCell><TableCell>{money(s.monthlyEstimateKopecks)}</TableCell><TableCell>{money(s.projectedAnnualKopecks)}</TableCell></TableRow>; })}</TableBody>
        </Table>
        <Typography>everyday: медиана; irregular/emergency: историческое распределение за год, не предсказание событий. Цели/капитал требуют ручного плана. Производные оценки округляются до копейки; исходные суммы не округляются. Выбросы остаются в истории.</Typography>
      </> : <Alert severity="error">Оценка недоступна: {result && !result.ok ? result.error.code : 'invalid_assumption'}. Итоги не рассчитаны.</Alert>}
    </>}
  </Stack>;
};
