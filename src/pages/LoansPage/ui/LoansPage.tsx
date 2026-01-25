import { Box, Typography } from '@mui/material';
import {
  useGetMonthlySummaryQuery,
  useSyncExpensesWithStore,
} from 'entities/Expense';
import { selectExpensesState } from 'entities/Expense/model/selectors';
import { useDispatch, useSelector } from 'react-redux';

const LoansPage = () => {
  const dispatch = useDispatch();
  const { isLoading } = useSyncExpensesWithStore();
  const { year, month /*page, limit*/ } = useSelector(selectExpensesState);

  // const isOpen = useSelector(selectIsOpenExpenseModal);

  // const handleOpenModal = () => {
  //   dispatch(open());
  // };
  // const handleCloseModal = () => {
  //   dispatch(close());
  // };

  // const totalSum =
  //   monthlySummary?.expenses?.reduce(
  //     (sum, expense) => sum + expense.amount,
  //     0,
  //   ) || 0;

  if (isLoading) return <Typography variant="h5">Loading...</Typography>;

  return (
    <Box p={2}>
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
            Займы и Кредиты
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default LoansPage;
