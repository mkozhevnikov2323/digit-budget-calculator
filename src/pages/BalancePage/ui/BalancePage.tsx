import { Box, Typography } from '@mui/material';
import { BalanceCard } from 'entities/Balance';

const BalancePage = () => {
  return (
    <Box p={2}>
      <Typography
        variant="h4"
        gutterBottom
      >
        Ваш финансовый баланс
      </Typography>
      <BalanceCard />
    </Box>
  );
};

export default BalancePage;
