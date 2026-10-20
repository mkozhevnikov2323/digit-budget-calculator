import { Box, Typography, Divider, Button, Alert } from '@mui/material';
import { useSyncIncomesWithStore } from 'entities/Income';
import { useDispatch, useSelector } from 'react-redux';
import { IncomeCharts } from 'widgets/IncomeCharts';
import { IncomeTable } from 'widgets/IncomeTable';
import {
  AddIncomeModal,
  close,
  open,
  selectIsOpenIncomeModal,
} from 'widgets/Modals/AddIncomeModal';

const IncomePage = () => {
  const dispatch = useDispatch();
  const { isLoading, isError, currentData } = useSyncIncomesWithStore();

  const isOpen = useSelector(selectIsOpenIncomeModal);

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
      {isError && <Alert severity="error">Ошибка при загрузке доходов</Alert>}
      {isLoading ? (
        <Typography variant="h5">Loading...</Typography>
      ) : currentData ? (
        <>
          <IncomeCharts />
          <IncomeTable />
        </>
      ) : null}
    </Box>
  );
};

export default IncomePage;
