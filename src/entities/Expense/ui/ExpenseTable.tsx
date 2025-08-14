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
  Select,
  MenuItem,
  Pagination,
} from '@mui/material';
import { ExportCSVButton } from 'features/ExportCSV';
import { sortByDate } from 'shared/lib/utils/utils';
import { useState } from 'react';
import {
  COLORS,
  getRowColorIndexesByDate,
} from 'shared/lib/utils/getRowColorByDate';
import { EditExpenseModal } from 'widgets/Modals/EditExpenseModal';
import { useSelector, useDispatch } from 'react-redux';
import { setPage, setYear, setMonth } from '../model/expenseSlice';
import { useSyncExpensesWithStore } from '../hooks/useSyncExpensesWithStore';
import { selectExpensesState } from '../model/selectors';
import { ExpenseSchema } from '../model/types';

export const ExpenseTable = () => {
  const [editId, setEditId] = useState<string | number | undefined>(undefined);
  const dispatch = useDispatch();

  const {
    list: expenses = [],
    total,
    page,
    limit,
    year,
    month,
  } = useSelector(selectExpensesState);

  const { isLoading } = useSyncExpensesWithStore();

  if (isLoading) return <>Загрузка...</>;

  const sortedExpenses = sortByDate(expenses as ExpenseSchema[]);

  const expensesMappedForExport = sortedExpenses?.map((expense, index) => ({
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
          gap: 2,
        }}
      >
        <Typography variant="h6">Таблица расходов</Typography>
        <ExportCSVButton
          data={expensesMappedForExport}
          filename="expenses.csv"
        />
      </Box>

      <Box
        mb={2}
        sx={{ display: 'flex', gap: 2 }}
      >
        <Select
          value={year}
          onChange={(e) => dispatch(setYear(Number(e.target.value)))}
          size="small"
        >
          <MenuItem value={2024}>2024</MenuItem>
          <MenuItem value={2025}>2025</MenuItem>
        </Select>

        <Select
          value={month}
          onChange={(e) => dispatch(setMonth(Number(e.target.value)))}
          size="small"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <MenuItem
              key={m}
              value={m}
            >
              {m}
            </MenuItem>
          ))}
        </Select>
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
                <TableCell>{(page - 1) * limit + idx + 1}</TableCell>
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

      <Box
        mt={2}
        display="flex"
        justifyContent="center"
      >
        <Pagination
          count={Math.ceil(total / limit)}
          page={page}
          onChange={(_, value) => dispatch(setPage(value))}
          color="primary"
        />
      </Box>

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
