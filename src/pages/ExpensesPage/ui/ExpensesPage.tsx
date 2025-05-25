import { Box, Typography, Divider, Button } from '@mui/material';
import { ExpenseTable } from 'entities/Expense';
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

  const isOpen = useSelector(selectIsOpenExpenseModal);

  const handleOpenModal = () => {
    dispatch(open());
  };
  const handleCloseModal = () => {
    dispatch(close());
  };

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
        onClick={handleOpenModal}
      >
        Добавить доход
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
