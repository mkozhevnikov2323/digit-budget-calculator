import { useGetIncomesQuery } from '../api/incomeApi';
import { LineChart } from '@mui/x-charts/LineChart';
import { Paper, Typography } from '@mui/material';
import { IncomeSchema } from '../model/types';
import { parseDateString } from 'shared/lib/utils/utils';

type AccResponse = Record<string, number>;

const groupByDate = (incomes: IncomeSchema[]) => {
  const grouped = incomes.reduce<AccResponse>((acc, income) => {
    const d = new Date(income.date).toLocaleDateString();
    acc[d] = (acc[d] ?? 0) + income.amount;
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => {
    const dateA = parseDateString(a);
    const dateB = parseDateString(b);
    return dateA.getTime() - dateB.getTime();
  });

  return { grouped, sortedDates };
};

export const LineChartIncome = () => {
  const { data: incomes = [], isLoading } = useGetIncomesQuery();

  if (isLoading) return <>Загрузка графика...</>;
  if (!incomes.length) return <>Нет данных для отображения графика</>;

  const { grouped, sortedDates } = groupByDate(incomes);
  const data = sortedDates.map((date) => grouped[date]);

  return (
    <Paper sx={{ mt: 2, p: 2 }}>
      <Typography
        variant="h6"
        mb={2}
      >
        Динамика доходов по датам
      </Typography>
      <LineChart
        xAxis={[{ scaleType: 'point', data: sortedDates, label: 'Дата' }]}
        series={[{ data, label: 'Расход (₽)' }]}
        height={400}
      />
    </Paper>
  );
};
