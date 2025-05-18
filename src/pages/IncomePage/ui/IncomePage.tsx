import { Box, Typography, Divider } from '@mui/material';
import { AddIncomeForm } from 'features/AddIncome';
import { IncomeTable } from 'entities/Income';

const IncomePage = () => {
  return (
    <Box p={2}>
      <Typography
        variant="h4"
        gutterBottom
      >
        Доходы
      </Typography>
      <AddIncomeForm />
      <Divider sx={{ my: 4 }} />
      <IncomeTable />
    </Box>
  );
};

export default IncomePage;
