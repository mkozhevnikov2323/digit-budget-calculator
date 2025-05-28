import { Box, Typography } from '@mui/material';
import { BalanceCard } from 'entities/Balance';
import { BarChartBalance } from 'widgets/BalanceCharts';

const BalancePage = () => {
  return (
    <Box p={2}>
      <Typography
        variant="h4"
        gutterBottom
      >
        Ваш финансовый баланс
      </Typography>
      <BarChartBalance />
      <BalanceCard />
    </Box>
  );
};

export default BalancePage;
