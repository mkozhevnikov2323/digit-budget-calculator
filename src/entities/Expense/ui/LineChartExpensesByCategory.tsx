import { useGetExpensesQuery } from '../api/expenseApi';
import { LineChart } from '@mui/x-charts/LineChart';
import { Paper, Typography } from '@mui/material';
import { ExpenseSchema } from '../model/types';
import { parseDateString } from 'shared/lib/utils/utils';

type CategoryData = Record<string, number>;

const groupExpensesByDateAndCategory = (expenses: ExpenseSchema[]) => {
  const grouped: Record<string, CategoryData> = {};

  expenses.forEach((expense) => {
    const dateLabel = new Date(expense.date).toLocaleDateString();

    if (!grouped[dateLabel]) grouped[dateLabel] = {};
    grouped[dateLabel][expense.category] =
      (grouped[dateLabel][expense.category] ?? 0) + expense.amount;
  });

  const sortedDates = Object.keys(grouped).sort((a, b) => {
    const dateA = parseDateString(a);
    const dateB = parseDateString(b);
    return dateA.getTime() - dateB.getTime();
  });

  return { grouped, sortedDates };
};

export const LineChartExpensesByCategory = () => {
  const { data: expenses = [], isLoading } = useGetExpensesQuery();

  if (isLoading) return <>Загрузка графика расходов по категориям...</>;
  if (!expenses.length)
    return <>Нет данных для отображения графика расходов по категориям</>;

  const { grouped, sortedDates } = groupExpensesByDateAndCategory(expenses);

  const allCategories = Array.from(
    new Set(
      Object.values(grouped).flatMap((categoriesObj) =>
        Object.keys(categoriesObj),
      ),
    ),
  );

  const series = allCategories.map((category) => ({
    label: category,
    data: sortedDates.map((date) => grouped[date][category] ?? 0),
  }));

  return (
    <Paper sx={{ mt: 2, p: 2 }}>
      <Typography
        variant="h6"
        mb={2}
      >
        Динамика расходов по категориям и датам
      </Typography>
      <LineChart
        xAxis={[
          {
            scaleType: 'point',
            data: sortedDates,
            label: 'Дата',
          },
        ]}
        series={series}
        height={400}
      />
    </Paper>
  );
};
