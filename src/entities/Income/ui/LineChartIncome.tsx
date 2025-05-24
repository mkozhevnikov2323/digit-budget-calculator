import { useGetIncomesQuery } from '../api/incomeApi';
import { LineChart } from '@mui/x-charts/LineChart';
import { Paper, Typography } from '@mui/material';
import { IncomeSchema } from '../model/types';

type AccResponse = Record<string, number>;

const groupByDate = (incomes: IncomeSchema[]): AccResponse => {
  return incomes.reduce<AccResponse>((acc, income) => {
    const d = new Date(income.date).toLocaleDateString();
    acc[d] = (acc[d] ?? 0) + income.amount;
    return acc;
  }, {});
};

export const LineChartIncome = () => {
  const { data: incomes = [], isLoading } = useGetIncomesQuery();

  if (isLoading) return <>Загрузка графика...</>;
  if (!incomes.length) return <>Нет данных для отображения графика</>;

  const grouped = groupByDate(incomes);
  const labels = Object.keys(grouped);
  const data = labels.map((date) => grouped[date]);

  return (
    <Paper sx={{ mt: 2, p: 2 }}>
      <Typography
        variant="h6"
        mb={2}
      >
        Динамика доходов по датам
      </Typography>
      <LineChart
        xAxis={[{ scaleType: 'point', data: labels, label: 'Дата' }]}
        series={[{ data, label: 'Доход (₽)' }]}
        height={300}
      />
    </Paper>
  );
};
