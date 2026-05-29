import { Box, CircularProgress, Typography } from '@mui/material';
import { useLoanHistory } from 'entities/Expense';
import { LoanRecipientAccordion } from 'widgets/Loans/LoanRecipientAccordion';

const LoansPage = () => {
  const { loanGroups, isLoading, error } = useLoanHistory();

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        p={4}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Typography color="error">
          Не удалось загрузить данные о займах.
        </Typography>
      </Box>
    );
  }

  if (loanGroups.length === 0) {
    return (
      <Box p={2}>
        <Typography>Нет выданных займов.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 1200, mx: 'auto' }}>
      <Typography
        variant="h5"
        gutterBottom
      >
        Выданные займы
      </Typography>
      {loanGroups.map((group) => (
        <LoanRecipientAccordion
          key={group.recipient}
          group={group}
        />
      ))}
    </Box>
  );
};

export default LoansPage;
