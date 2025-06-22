import { Box, Typography, Divider, Button } from '@mui/material';
import { IncomeTable, useSyncIncomeWithStore } from 'entities/Income';
import { useDispatch, useSelector } from 'react-redux';
import { IncomeCharts } from 'widgets/IncomeCharts';
import {
  AddIncomeModal,
  close,
  open,
  selectIsOpenIncomeModal,
} from 'widgets/Modals/AddIncomeModal';

const IncomePage = () => {
  const dispatch = useDispatch();
  const { isLoading } = useSyncIncomeWithStore();

  const isOpen = useSelector(selectIsOpenIncomeModal);

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
        Доходы
      </Typography>
      <Button
        variant="contained"
        color="success"
        onClick={handleOpenModal}
      >
        Добавить доход
      </Button>
      <AddIncomeModal
        open={isOpen}
        onClose={handleCloseModal}
      />
      <Divider sx={{ my: 4 }} />
      <IncomeCharts />
      <IncomeTable />
    </Box>
  );
};

export default IncomePage;
