import { Alert, Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { type Analytics, formatMoney } from '../model/calculations';

export const AnalyticsResults = ({ data }: { data: Analytics }) => {
  const cards = [
    ['Сумма приходных операций', formatMoney(data.incomeKopecks)],
    ['Сумма расходных операций', formatMoney(data.expenseKopecks)],
    ['Разность сумм прихода и расхода', formatMoney(data.differenceKopecks)],
    ['Количество записей доходов', String(data.incomeCount)],
    ['Количество записей расходов', String(data.expenseCount)],
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
      <Paper variant="outlined" sx={{ p: { xs: 1, sm: 2 }, minWidth: 0 }}>
        <Typography variant="h6">Расходные операции по категориям</Typography>
        <Typography variant="body2" color="text.secondary">
          Категория описывает назначение расхода, финансовый слой — роль денег. Автоматическое распределение по слоям не выполняется.
        </Typography>
        {!data.expenseCount ? <Alert severity="info" sx={{ mt: 1 }}>В этом периоде расходных записей нет.</Alert> : <>
          {data.categories.length > 12 && <Typography variant="caption">На графике показаны 12 крупнейших категорий; таблица содержит все категории.</Typography>}
          <Box sx={{ width: '100%', minWidth: 0, overflow: 'hidden' }}>
            <BarChart layout="horizontal" height={Math.max(220, chartCategories.length * 28 + 60)}
              margin={{ left: 135, right: 20 }}
              yAxis={[{ scaleType: 'band', data: chartCategories.map((category) => category.category),
                valueFormatter: (name: string) => name.length > 18 ? `${name.slice(0, 17)}…` : name }]}
              xAxis={[{ label: 'Сумма, ₽', valueFormatter: (value: number) => (value / 100).toLocaleString('ru-RU') }]}
              series={[{ label: 'Расходные операции', data: chartCategories.map((category) => category.kopecks),
                valueFormatter: (value) => value === null ? '—' : formatMoney(value) }]} />
          </Box>
          <TableContainer>
            <Table size="small" aria-label="Расходные операции по категориям" sx={{ tableLayout: 'fixed', '& td, & th': { px: 1, overflowWrap: 'anywhere' } }}>
              <TableHead><TableRow>
                <TableCell sx={{ width: '36%' }}>Категория</TableCell><TableCell align="right">Сумма</TableCell>
                <TableCell align="right">Доля</TableCell><TableCell align="right">Записей</TableCell>
              </TableRow></TableHead>
              <TableBody>{data.categories.map((category) => <TableRow key={category.category}>
                <TableCell component="th" scope="row">{category.category}</TableCell>
                <TableCell align="right">{formatMoney(category.kopecks)}</TableCell>
                <TableCell align="right">{category.share.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%</TableCell>
                <TableCell align="right">{category.count}</TableCell>
              </TableRow>)}</TableBody>
            </Table>
          </TableContainer>
        </>}
      </Paper>
      <Paper variant="outlined" sx={{ p: { xs: 1, sm: 2 }, minWidth: 0 }}>
        <Typography variant="h6">Динамика расходных операций</Typography>
        {!data.expenseCount ? <Typography color="text.secondary">Нет расходных операций для графика динамики.</Typography> : (
          <Box sx={{ width: '100%', minWidth: 0, overflow: 'hidden' }}>
            <LineChart height={300} margin={{ left: 65, right: 20 }}
              xAxis={[{ scaleType: 'point', data: data.dynamics.map((point) => point.key), label: 'Период (UTC)', tickLabelMinGap: 30 }]}
              yAxis={[{ label: '₽', valueFormatter: (value: number) => (value / 100).toLocaleString('ru-RU') }]}
              series={[{ label: 'Расходные операции', data: data.dynamics.map((point) => point.kopecks), showMark: false,
                valueFormatter: (value) => value === null ? '—' : formatMoney(value) }]} />
          </Box>
        )}
      </Paper>
    </>
  );
};
