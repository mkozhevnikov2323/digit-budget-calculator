import { Button, Typography } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAppDispatch } from 'app/providers/store/hooks';
import { logout } from '../model/authThunks';
import { useNavigate } from 'react-router';
import { selectUser } from 'entities/User';
import { useSelector } from 'react-redux';

export const LogoutButton = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectUser);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  return (
    <>
      <Typography sx={{ mr: 2 }}>{user?.email}</Typography>
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
  );
};
