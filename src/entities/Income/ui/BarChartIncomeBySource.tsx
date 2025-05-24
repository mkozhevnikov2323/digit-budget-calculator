import { useGetIncomesQuery } from '../api/incomeApi';
import { BarChart } from '@mui/x-charts/BarChart';
import { Paper, Typography } from '@mui/material';
import { IncomeSchema } from '../model/types';

const groupBySource = (incomes: IncomeSchema[]): Record<string, number> => {
  return incomes.reduce<Record<string, number>>((acc, income) => {
    acc[income.source] = (acc[income.source] ?? 0) + income.amount;
    return acc;
  }, {});
};

export const BarChartIncomeBySource = () => {
  const { data: incomes = [], isLoading } = useGetIncomesQuery();

  if (isLoading) return <>Загрузка графика...</>;
  if (!incomes.length) return <>Нет данных для отображения графика</>;

  const grouped = groupBySource(incomes);

  const sources = Object.keys(grouped);
  const values = Object.values(grouped);

  return (
    <Paper sx={{ mt: 2, p: 2 }}>
      <Typography
        variant="h6"
        mb={2}
      >
        Сумма доходов по источникам
      </Typography>
      <BarChart
        xAxis={[{ data: sources, label: 'Источник' }]}
        series={[{ data: values, label: 'Сумма' }]}
        height={300}
      />
    </Paper>
  );
};
