import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { useState } from 'react';
import { Modal } from 'shared/ui/Modal';

export const Navbar = () => {
  const [openAuthModal, setOpenAuthModal] = useState(false);

  const handleOpenModal = () => setOpenAuthModal(true);

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
          <Button
            color="inherit"
            onClick={handleOpenModal}
          >
            Вход / Регистрация
          </Button>
        </Toolbar>
      </AppBar>
      <Modal
        open={openAuthModal}
        onClose={setOpenAuthModal}
      />
    </Box>
  );
};
