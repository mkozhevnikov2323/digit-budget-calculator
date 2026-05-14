import {
  Table,
  TableContainer,
  Paper,
  Box,
  Typography,
  Pagination,
} from '@mui/material';
import { ExportCSVButton } from 'features/ExportCSV';
import { sortByDate } from 'shared/lib/utils/utils';
import { useState } from 'react';
import { getRowColorIndexesByDate } from 'shared/lib/utils/getRowColorByDate';
import { EditExpenseModal } from 'widgets/Modals/EditExpenseModal';
import { useSelector, useDispatch } from 'react-redux';
import { MonthSelector } from 'shared/ui/MonthSelector';
import { YearSelector } from 'shared/ui/YearSelector';
import { ExpenseTableHeader } from './ExpenseTableHeader';
import { ExpenseTableBody } from './ExpenseTableBody';
import {
  ExpenseSchema,
  selectExpensesState,
  setMonth,
  setPage,
  setYear,
  useSyncExpensesWithStore,
} from 'entities/Expense';

export const ExpenseTable = () => {
  const [editId, setEditId] = useState<string | undefined>(undefined);
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

  if (isLoading) {
    return <Typography>Загрузка...</Typography>;
  }

  const sortedExpenses = sortByDate(expenses as ExpenseSchema[]);

  const expensesMappedForExport = sortedExpenses.map((expense, index) => ({
    Номер: (page - 1) * limit + index + 1,
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
        <YearSelector
          currentYear={year}
          onChangeYear={(y) => dispatch(setYear(y))}
          sx={{ minWidth: 120 }}
        />
        <MonthSelector
          currentMonth={month}
          onChangeMonth={(m) => dispatch(setMonth(m))}
          sx={{ minWidth: 150 }}
        />
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <ExpenseTableHeader />
          <ExpenseTableBody
            expenses={sortedExpenses}
            rowColorIndexes={rowColorIndexes}
            page={page}
            limit={limit}
            onEdit={setEditId}
          />
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
