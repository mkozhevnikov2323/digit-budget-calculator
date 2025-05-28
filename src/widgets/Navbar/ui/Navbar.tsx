import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useSelector } from 'react-redux';
import { selectUser } from 'entities/User';
import {
  AuthButton,
  AuthModal,
  LogoutButton,
  selectIsAuthenticated,
} from 'features/Authorization';
import { Navigation } from 'widgets/Navigation';
import { useMediaQuery, useTheme } from '@mui/material';
import { MobileMenu } from 'widgets/MobileMenu';

export const Navbar = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const user = useSelector(selectUser);
  const isAuth = useSelector(selectIsAuthenticated);

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Typography
              variant="h6"
              component="div"
            >
              Калькулятор бюджета
            </Typography>
            {isAuth && <Navigation />}
          </Box>

          {isMobile ? (
            <MobileMenu />
          ) : user ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <LogoutButton />
            </Box>
          ) : (
            <AuthButton />
          )}
        </Toolbar>
      </AppBar>
      <AuthModal />
    </Box>
  );
};
