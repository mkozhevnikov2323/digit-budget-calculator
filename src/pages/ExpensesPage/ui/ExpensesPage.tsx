import { Box, Typography, Button } from '@mui/material';
import { useState } from 'react';
import {
  useGetMonthlySummaryQuery,
  useSyncExpensesWithStore,
} from 'entities/Expense';
import { selectExpensesState } from 'entities/Expense/model/selectors';
import { useDispatch, useSelector } from 'react-redux';
import { ExpenseTable } from 'widgets/Expenses/ExpenseTable';
import { MonthlySummaryExpenseTable } from 'widgets/Expenses/MonthlySummaryExpenseTable';
import {
  AddExpenseModal,
  close,
  open,
  selectIsOpenExpenseModal,
} from 'widgets/Modals/AddExpenseModal';
import { AddExpenseFromPhoto } from 'features/AddExpenseFromPhoto';
import { Modal } from 'shared/ui/Modal';

const ExpensesPage = () => {
  const dispatch = useDispatch();
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);
  const { isLoading } = useSyncExpensesWithStore();
  const { year, month /*page, limit*/ } = useSelector(selectExpensesState);
  const {
    data: monthlySummary,
    // isLoading: isSummaryLoading,
    // error: summaryError,
  } = useGetMonthlySummaryQuery({ year, month });

  const isOpen = useSelector(selectIsOpenExpenseModal);

  const handleOpenModal = () => {
    dispatch(open());
  };
  const handleCloseModal = () => {
    dispatch(close());
  };

  const totalSum =
    monthlySummary?.expenses?.reduce(
      (sum, expense) => sum + expense.amount,
      0,
    ) || 0;

  if (isLoading) return <Typography variant="h5">Loading...</Typography>;

  return (
    <Box p={2}>
      {/* <Divider sx={{ my: 4 }} /> */}

      <Box
        sx={{
          position: 'sticky',
          top: '0',
          zIndex: 1000,
          backgroundColor: 'background.paper',
          padding: 2,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <Box>
          <Typography
            variant="h4"
            gutterBottom
          >
            Расходы
          </Typography>
          <Button
            variant="contained"
            color="warning"
            onClick={handleOpenModal}
          >
            Добавить расход
          </Button>
          <Button
            variant="outlined"
            color="warning"
            onClick={() => setIsPhotoOpen(true)}
            sx={{ ml: 2 }}
          >
            Добавить по фото
          </Button>
        </Box>
      </Box>
      {/* <ExpenseCharts /> */}

      <Box>
        <Typography variant="h6">Сводные данные за месяц</Typography>
        <Box>
          {/* 1. Сводная таблица с категориями и суммами */}

          <MonthlySummaryExpenseTable expenses={monthlySummary?.expenses} />
        </Box>
        <Box>
          {/* 2. Итоговые данные */}
          <Typography>
            Итоговая сумма за месяц: {totalSum.toFixed(2)} руб.
          </Typography>
        </Box>
        <Box>
          {/* 3. Графики */}
          <Typography>Здесь будут графики</Typography>
        </Box>
      </Box>
      <ExpenseTable />
      <AddExpenseModal
        open={isOpen}
        onClose={handleCloseModal}
      />
      {isPhotoOpen && (
        <Modal
          open
          onClose={() => setIsPhotoOpen(false)}
        >
          <AddExpenseFromPhoto onCancel={() => setIsPhotoOpen(false)} />
        </Modal>
      )}
    </Box>
  );
};

export default ExpensesPage;
