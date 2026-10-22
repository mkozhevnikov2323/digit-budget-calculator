import { Alert, Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import type { FinancialAnalytics } from 'features/FinancialAnalytics/model/types';
import { formatKopecks } from 'features/FinancialAnalytics/model/money';
import { historyMonthStatus } from 'features/FinancialAnalytics/model/historyCoverage';

// Explicitly handle the PR #6 result contract. Invalid/missing money is never 0.
const moneyLabel = (kopecks: number | null): string => {
  if (kopecks === null) return 'Сумма недоступна';
  const formatted = formatKopecks(kopecks);
  return formatted.ok ? formatted.value : 'Некорректная сумма';
};

export const AnalyticsResults = ({ data, observedAt = Date.now() }: { data: FinancialAnalytics; observedAt?: number }) => {
  const cards = [
    ['Записанные поступления', moneyLabel(data.incomeKopecks)],
    ['Записанные расходы', moneyLabel(data.expenseKopecks)],
    ['Разность поступлений и расходов', moneyLabel(data.differenceKopecks)],
    ['Количество записей доходов', String(data.incomeCount)],
    ['Количество записей расходов', String(data.expenseCount)],
    ['Выданные займы — уже в расходах', moneyLabel(data.loans.issuedKopecks)],
    ['Возвраты займов — уже в поступлениях', moneyLabel(data.loans.returnedKopecks)],
  ];
  const chartCategories = data.categories.slice(0, 12);
  return (
    <>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }}>
        {cards.map(([label, value]) => (
          <Paper key={label} variant="outlined" sx={{ p: 2, minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            <Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>{value}</Typography>
          </Paper>
        ))}
      </Box>
      {!data.expenseCount && !data.incomeCount && <Alert severity="info">За выбранный период операций нет.</Alert>}
      <Alert severity="info">Полнота ответа означает все возвращённые сервером записи, а не подтверждение полноты учёта в реальной жизни. Ноль записей не доказывает отсутствие расходов. Текущие и будущие месяцы не являются завершённой историей.</Alert>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label="Помесячный денежный поток">
          <TableHead><TableRow>{['Месяц UTC', 'История', 'Поступления', 'Расходы', 'Записей доходов / расходов'].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
          <TableBody>{data.months?.map(month => <TableRow key={month.key}>
            <TableCell>{month.key}</TableCell><TableCell>{({ elapsed: 'Период завершён', partial_period: 'Выбрана часть месяца',
              current_partial: 'Месяц не завершён', future: 'Будущий месяц', unavailable: 'Статус недоступен' })[historyMonthStatus(month.key, data.period, observedAt)]}</TableCell>
            <TableCell>{moneyLabel(month.incomeKopecks)}</TableCell><TableCell>{moneyLabel(month.expenseKopecks)}</TableCell>
            <TableCell>{month.incomeCount} / {month.expenseCount}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </TableContainer>
      <Paper variant="outlined" sx={{ p: { xs: 1, sm: 2 }, minWidth: 0 }}>
        <Typography variant="h6" component="h2">Расходные операции по категориям</Typography>
        <Typography variant="body2" color="text.secondary">
          Категория описывает назначение расхода, финансовый слой — роль денег. Автоматическое распределение по слоям не выполняется.
        </Typography>
        {!data.expenseCount ? <Alert severity="info" sx={{ mt: 1 }}>В этом периоде расходных записей нет.</Alert> : <>
          {data.categories.length > 12 && <Typography variant="caption">На графике показаны 12 крупнейших категорий; таблица содержит все категории.</Typography>}
          <Box sx={{ width: '100%', minWidth: 0, overflow: 'hidden' }}>
            <BarChart layout="horizontal" height={Math.max(220, chartCategories.length * 28 + 60)}
              aria-label="График категорий расходов" skipAnimation
              margin={{ left: 135, right: 20 }}
              yAxis={[{ scaleType: 'band', data: chartCategories.map((category) => category.category),
                valueFormatter: (name: string) => name.length > 18 ? `${name.slice(0, 17)}…` : name }]}
              xAxis={[{ scaleType: 'linear', label: 'Сумма, ₽', tickMinStep: 1, valueFormatter: moneyLabel }]}
              series={[{ label: 'Расходные операции', data: chartCategories.map((category) => category.kopecks),
                valueFormatter: moneyLabel }]} />
          </Box>
          <TableContainer>
            <Table size="small" aria-label="Расходные операции по категориям" sx={{ tableLayout: 'fixed', '& td, & th': { px: 1, overflowWrap: 'anywhere' } }}>
              <TableHead><TableRow>
                <TableCell sx={{ width: '36%' }}>Категория</TableCell><TableCell align="right">Сумма</TableCell>
                <TableCell align="right">Доля</TableCell><TableCell align="right">Записей</TableCell>
              </TableRow></TableHead>
              <TableBody>{data.categories.map((category) => <TableRow key={category.category}>
                <TableCell component="th" scope="row">{category.category}</TableCell>
                <TableCell align="right">{moneyLabel(category.kopecks)}</TableCell>
                <TableCell align="right">{category.share.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%</TableCell>
                <TableCell align="right">{category.count}</TableCell>
              </TableRow>)}</TableBody>
            </Table>
          </TableContainer>
        </>}
      </Paper>
      <Paper variant="outlined" sx={{ p: { xs: 1, sm: 2 }, minWidth: 0 }}>
        <Typography variant="h6" component="h2">Месячная динамика расходов</Typography>
        <Typography variant="body2" color="text.secondary">Расходы по календарным месяцам UTC, включая месяцы без расходов. Это не дневные значения.</Typography>
        <Box sx={{ width: '100%', minWidth: 0, overflow: 'hidden' }}>
          <LineChart height={300} margin={{ left: 65, right: 20 }}
            aria-label="Месячная динамика расходов" skipAnimation
            xAxis={[{ scaleType: 'point', data: data.dynamics.map((point) => point.key), label: 'Месяц (UTC)', tickLabelMinGap: 30 }]}
            yAxis={[{ scaleType: 'linear', label: '₽', tickMinStep: 1, valueFormatter: moneyLabel }]}
            series={[{ label: 'Расходные операции', data: data.dynamics.map((point) => point.kopecks), showMark: true,
              valueFormatter: moneyLabel }]} />
        </Box>
      </Paper>
    </>
  );
};
