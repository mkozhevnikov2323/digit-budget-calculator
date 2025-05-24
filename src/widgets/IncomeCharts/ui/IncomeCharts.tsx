import { Box } from '@mui/material';
import {
  LineChartIncomeBySource,
  LineChartIncome,
  BarChartIncomeBySource,
} from 'entities/Income';

export const IncomeCharts = () => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: { xs: 'column', md: 'row' },
      gap: 2,
      mb: 4,
    }}
  >
    <Box flex={1}>
      <LineChartIncome />
    </Box>
    <Box flex={1}>
      <LineChartIncomeBySource />
    </Box>
    <Box flex={1}>
      <BarChartIncomeBySource />
    </Box>
  </Box>
);
