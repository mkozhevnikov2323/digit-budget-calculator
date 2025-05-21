import { Box, Typography, Divider } from '@mui/material';
import { AddExpenseForm } from 'features/AddExpense';
import { ExpenseTable } from 'entities/Expense';

const ExpensesPage = () => {
  return (
    <Box p={2}>
      <Typography
        variant="h4"
        gutterBottom
      >
        Расходы
      </Typography>
      <AddExpenseForm />
      <Divider sx={{ my: 4 }} />
      <ExpenseTable />
    </Box>
  );
};

export default ExpensesPage;
