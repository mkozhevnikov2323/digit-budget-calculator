import { lazy, Suspense, useState } from 'react';
import type { CalendarPeriod } from 'features/FinancialAnalytics/model/period';
import { Alert, Button, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { formatKopecks } from 'features/FinancialAnalytics/model/money';
import { FINANCIAL_LAYERS } from 'features/FinancialClassification/model/types';
import { syntheticClassifiedHistory } from '../model/synthetic';
import { STATUSES } from '../model/statistics';
const money = (x: number) => { const f = formatKopecks(x); return f.ok ? f.value : 'Недоступно'; };
const RealStatistics = lazy(() => import('./RealClassificationStatistics').then(m => ({ default: m.RealClassificationStatistics })));
export const ClassificationStatistics = ({ period }: { period?: CalendarPeriod | null } = {}) => {
  const [demo, setDemo] = useState(false);
  const result = demo ? syntheticClassifiedHistory() : null;
  if (period !== undefined) return <Suspense fallback={<Typography role="status">Загрузка модуля классификации…</Typography>}><RealStatistics period={period} /></Suspense>;
  return <Stack spacing={1} component="section" aria-label="Историческая статистика классификации">
    <Typography component="h2" variant="h6">Историческая статистика по классификации</Typography>
    <Alert severity="info" role="note">Реальные итоги по слоям недоступны: нужен согласованный полный источник, связывающий факты и решения. Отдельные classification GET не подтверждают соответствие суммам истории.</Alert>
    <Button onClick={() => setDemo(v => !v)}>{demo ? 'Закрыть вымышленный пример статистики' : 'Показать вымышленный пример статистики'}</Button>
    {result?.ok && <>
      <Alert severity="warning">ДЕМО · Только вымышленные операции 2025 года. Это не ваша финансовая история.</Alert>
      <Typography>Записанные расходы: {money(result.value.expenses.recorded.kopecks)} · {result.value.expenses.recorded.count} операций.</Typography>
      <Typography>Записанные поступления: {money(result.value.incomes.recorded.kopecks)} · {result.value.incomes.recorded.count} операций.</Typography>
      <Typography>Подтверждено по количеству: {((result.value.expenses.coverage.byCount ?? 0) * 100).toFixed(1)}%; по сумме: {((result.value.expenses.coverage.byAmount ?? 0) * 100).toFixed(1)}%.</Typography>
      <Table size="small" aria-label="Слои и статусы вымышленных расходов"><TableHead><TableRow><TableCell>Группа</TableCell><TableCell>Сумма</TableCell><TableCell>Записей</TableCell></TableRow></TableHead>
        <TableBody>{FINANCIAL_LAYERS.map(layer => <TableRow key={layer}><TableCell>{layer} · ordinary_expense</TableCell><TableCell>{money(result.value.expenses.layers[layer].kopecks)}</TableCell><TableCell>{result.value.expenses.layers[layer].count}</TableCell></TableRow>)}
          {STATUSES.map(status => <TableRow key={status}><TableCell>Статус: {status}</TableCell><TableCell>{money(result.value.expenses.statuses[status].kopecks)}</TableCell><TableCell>{result.value.expenses.statuses[status].count}</TableCell></TableRow>)}
          {Object.entries(result.value.expenses.roles).map(([role, b]) => <TableRow key={role}><TableCell>Роль: {role}</TableCell><TableCell>{money(b.kopecks)}</TableCell><TableCell>{b.count}</TableCell></TableRow>)}</TableBody>
      </Table>
      <Typography>Слои — только ordinary_expense. Займы/переводы/капитал учитываются отдельно в экономических ролях, внутри записанного потока; строки ролей и статусов не складываются друг с другом.</Typography>
      <Table size="small" aria-label="Вымышленная месячная динамика слоёв"><TableHead><TableRow><TableCell>Месяц</TableCell>{FINANCIAL_LAYERS.map(l => <TableCell key={l}>{l}</TableCell>)}</TableRow></TableHead>
        <TableBody>{result.value.months.map(m => <TableRow key={m.key}><TableCell>{m.key}</TableCell>{FINANCIAL_LAYERS.map(l => <TableCell key={l}>{money(m.expenses.layers[l].kopecks)}</TableCell>)}</TableRow>)}</TableBody>
      </Table>
    </>}
  </Stack>;
};
