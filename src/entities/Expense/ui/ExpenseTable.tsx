import {
  Table,
  TableCell,
  TableContainer,
  TableHead,
  TableBody,
  TableRow,
  Paper,
} from '@mui/material';
import { useGetExpensesQuery } from '../api/expenseApi';

export const ExpenseTable = () => {
  const { data: expenses = [], isLoading } = useGetExpensesQuery();

  if (isLoading) return <>Загрузка...</>;

  return (
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
            <TableRow key={expense.id}>
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
  );
};
