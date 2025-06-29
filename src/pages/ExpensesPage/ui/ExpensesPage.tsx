import { Box, Typography, Divider, Button } from '@mui/material';
import { ExpenseTable, useSyncExpensesWithStore } from 'entities/Expense';
import { useDispatch, useSelector } from 'react-redux';
import { ExpenseCharts } from 'widgets/ExpenseCharts';
import {
  AddExpenseModal,
  close,
  open,
  selectIsOpenExpenseModal,
} from 'widgets/Modals/AddExpenseModal';

const ExpensesPage = () => {
  const dispatch = useDispatch();
  const { isLoading } = useSyncExpensesWithStore();

  const isOpen = useSelector(selectIsOpenExpenseModal);

  const handleOpenModal = () => {
    dispatch(open());
  };
  const handleCloseModal = () => {
    dispatch(close());
  };

  if (isLoading) return <Typography variant="h5">Loading...</Typography>;

  return (
    <Box p={2}>
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
      <AddExpenseModal
        open={isOpen}
        onClose={handleCloseModal}
      />
      <Divider sx={{ my: 4 }} />
      <ExpenseCharts />
      <ExpenseTable />
    </Box>
  );
};

export default ExpensesPage;
