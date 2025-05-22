import { Box, Typography, Divider, Button } from '@mui/material';
import { IncomeTable } from 'entities/Income';
import { useDispatch, useSelector } from 'react-redux';
import {
  AddIncomeModal,
  close,
  open,
  selectIsOpenIncomeModal,
} from 'widgets/Modals/AddIncomeModal';

const IncomePage = () => {
  const dispatch = useDispatch();

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
        onClick={handleOpenModal}
      >
        Добавить доход
      </Button>
      <AddIncomeModal
        open={isOpen}
        onClose={handleCloseModal}
      />
      <Divider sx={{ my: 4 }} />
      <IncomeTable />
    </Box>
  );
};

export default IncomePage;
