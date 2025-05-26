import { useGetExpensesQuery } from '../api/expenseApi';
import { LineChart } from '@mui/x-charts/LineChart';
import { Paper, Typography } from '@mui/material';
import { ExpenseSchema } from '../model/types';
import { parseDateString } from 'shared/lib/utils/utils';

type AccResponse = Record<string, number>;

const groupByDateSorted = (expenses: ExpenseSchema[]) => {
  const grouped = expenses.reduce<AccResponse>((acc, expense) => {
    const d = new Date(expense.date).toLocaleDateString();
    acc[d] = (acc[d] ?? 0) + expense.amount;
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => {
    const dateA = parseDateString(a);
    const dateB = parseDateString(b);
    return dateA.getTime() - dateB.getTime();
  });

  return { grouped, sortedDates };
};

export const LineChartExpenses = () => {
  const { data: expenses = [], isLoading } = useGetExpensesQuery();

  if (isLoading) return <>Загрузка графика расходов...</>;
  if (!expenses.length) return <>Нет данных для отображения графика расходов</>;

  const { grouped, sortedDates } = groupByDateSorted(expenses);
  const data = sortedDates.map((date) => grouped[date]);

  return (
    <Paper sx={{ mt: 2, p: 2 }}>
      <Typography
        variant="h6"
        mb={2}
      >
        Динамика расходов по датам
      </Typography>
      <LineChart
        xAxis={[{ scaleType: 'point', data: sortedDates, label: 'Дата' }]}
        series={[{ data, label: 'Расход (₽)' }]}
        height={400}
      />
    </Paper>
  );
};
