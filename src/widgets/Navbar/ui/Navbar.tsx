import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { useDispatch, useSelector } from 'react-redux';
import { selectUser } from 'entities/User';
import { AuthModal, openAuthModal } from 'features/Authorization';

export const Navbar = () => {
  const dispatch = useDispatch();
  const handleOpenModal = () => dispatch(openAuthModal());

  const user = useSelector(selectUser);

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography
            variant="h6"
            component="div"
            sx={{ flexGrow: 1 }}
          >
            Калькулятор бюджета
          </Typography>
          {user ? (
            <Typography>{user.email}</Typography>
          ) : (
            <Button
              color="inherit"
              onClick={handleOpenModal}
            >
              Вход / Регистрация
            </Button>
          )}
        </Toolbar>
      </AppBar>
      <AuthModal />
    </Box>
  );
};
