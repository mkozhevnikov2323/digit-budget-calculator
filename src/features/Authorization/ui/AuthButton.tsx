import { Button } from '@mui/material';
import { useAppDispatch } from 'app/providers/store/hooks';
import { openAuthModal } from '../model/authorizationSlice';

export const AuthButton = () => {
  const dispatch = useAppDispatch();
  const handleOpenModal = () => dispatch(openAuthModal());

  return (
    <Button
      color="inherit"
      onClick={handleOpenModal}
    >
      Вход / Регистрация
    </Button>
  );
};
