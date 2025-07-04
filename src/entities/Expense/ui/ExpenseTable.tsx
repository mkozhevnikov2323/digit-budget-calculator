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
  Button,
} from '@mui/material';
import { useGetExpensesQuery } from '../api/expenseApi';
import { ExportCSVButton } from 'features/ExportCSV';
import { sortByDate } from 'shared/lib/utils/utils';
import { useState } from 'react';
import {
  COLORS,
  getRowColorIndexesByDate,
} from 'shared/lib/utils/getRowColorByDate';
import { EditExpenseModal } from 'widgets/Modals/EditExpenseModal';

export const ExpenseTable = () => {
  const [editId, setEditId] = useState<string | number | undefined>(undefined);
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

  const rowColorIndexes = getRowColorIndexesByDate(sortedExpenses);

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
              <TableCell>Управление</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedExpenses.map((expense, idx) => (
              <TableRow
                key={expense._id || idx}
                sx={{
                  backgroundColor: COLORS[rowColorIndexes[idx]],
                }}
              >
                <TableCell>{idx + 1}</TableCell>
                <TableCell>
                  {new Date(expense.date).toLocaleDateString()}
                </TableCell>
                <TableCell>{expense.amount}</TableCell>
                <TableCell>{expense.title}</TableCell>
                <TableCell>{expense.category}</TableCell>
                <TableCell>{expense.recipient}</TableCell>
                <TableCell>{expense.comment}</TableCell>
                <TableCell>
                  <Button
                    onClick={() => setEditId(expense._id)}
                    variant="text"
                  >
                    Редактировать
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {editId && (
        <EditExpenseModal
          open={!!editId}
          onClose={() => setEditId(undefined)}
          expenseId={editId}
        />
      )}
    </Box>
  );
};
