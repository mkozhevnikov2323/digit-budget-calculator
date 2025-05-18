import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { useSelector } from 'react-redux';
import { selectUser } from 'entities/User';
import { AuthModal, logout, openAuthModal } from 'features/Authorization';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAppDispatch } from 'app/providers/store/hooks';

export const Navbar = () => {
  const dispatch = useAppDispatch();
  const handleOpenModal = () => dispatch(openAuthModal());

  const user = useSelector(selectUser);

  const handleLogout = () => {
    dispatch(logout());
  };

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
            <>
              <Typography sx={{ marginRight: 2 }}>{user.email}</Typography>
              <Button
                color="inherit"
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
                sx={{
                  border: '1px solid',
                  backgroundColor: 'grey',
                }}
              >
                Выйти
              </Button>
            </>
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
