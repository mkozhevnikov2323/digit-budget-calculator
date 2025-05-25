import { useGetExpensesQuery } from '../api/expenseApi';
import { BarChart } from '@mui/x-charts/BarChart';
import { Paper, Typography } from '@mui/material';
import { ExpenseSchema } from '../model/types';

const groupByCategory = (expenses: ExpenseSchema[]): Record<string, number> => {
  return expenses.reduce<Record<string, number>>((acc, expense) => {
    acc[expense.category] = (acc[expense.category] ?? 0) + expense.amount;
    return acc;
  }, {});
};

export const BarChartExpensesByCategory = () => {
  const { data: expenses = [], isLoading } = useGetExpensesQuery();

  if (isLoading) return <>Загрузка графика...</>;
  if (!expenses.length) return <>Нет данных для отображения графика</>;

  const grouped = groupByCategory(expenses);

  const categories = Object.keys(grouped);
  const values = Object.values(grouped);

  return (
    <Paper sx={{ mt: 2, p: 2 }}>
      <Typography
        variant="h6"
        mb={2}
      >
        Сумма расходов по категориям
      </Typography>
      <BarChart
        xAxis={[{ data: categories, label: 'Категория' }]}
        series={[{ data: values, label: 'Сумма (₽)' }]}
        height={400}
      />
    </Paper>
  );
};
