import {
  Table,
  TableCell,
  TableContainer,
  TableHead,
  TableBody,
  TableRow,
  Paper,
  Box,
  Typography,
} from '@mui/material';
import { useGetExpensesQuery } from '../api/expenseApi';
import { ExportCSVButton } from 'features/ExportCSV';
import { sortByDate } from 'shared/lib/utils/utils';

export const ExpenseTable = () => {
  const { data: expenses = [], isLoading } = useGetExpensesQuery();

  if (isLoading) return <>Загрузка...</>;

  const sortedExpenses = sortByDate(expenses);

  const expensesMappedForExport =
    sortedExpenses &&
    sortedExpenses?.map((expense, index) => ({
      Номер: index + 1,
      Дата: new Date(expense.date).toLocaleDateString(),
      Сумма: expense.amount,
      Наименование: expense.title,
      Получатель: expense.recipient,
      'Категория расхода': expense.category,
      Комментарий: expense.comment || '',
    }));

  return (
    <Box>
      <Box
        mb={2}
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography
          datatest-id="Headers table"
          variant="h6"
        >
          Таблица расходов
        </Typography>
        <ExportCSVButton
          data={expensesMappedForExport}
          filename="expenses.csv"
        />
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>№</TableCell>
              <TableCell>Дата</TableCell>
              <TableCell>Сумма</TableCell>
              <TableCell>Название</TableCell>
              <TableCell>Категория</TableCell>
              <TableCell>Получатель</TableCell>
              <TableCell>Комментарий</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {expenses.map((expense, idx) => (
              <TableRow key={idx}>
                <TableCell>{idx + 1}</TableCell>
                <TableCell>
                  {new Date(expense.date).toLocaleDateString()}
                </TableCell>
                <TableCell>{expense.amount}</TableCell>
                <TableCell>{expense.title}</TableCell>
                <TableCell>{expense.category}</TableCell>
                <TableCell>{expense.recipient}</TableCell>
                <TableCell>{expense.comment}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
