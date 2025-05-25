import { Box } from '@mui/material';
import {
  BarChartExpensesByCategory,
  LineChartExpenses,
  LineChartExpensesByCategory,
} from 'entities/Expense';

export const ExpenseCharts = () => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: { xs: 'column', md: 'row' },
      alignItems: 'stretch',
      gap: 2,
      mb: 4,
    }}
  >
    <Box flex={1}>
      <LineChartExpenses />
    </Box>
    <Box flex={1}>
      <LineChartExpensesByCategory />
    </Box>
    <Box flex={1}>
      <BarChartExpensesByCategory />
    </Box>
  </Box>
);
