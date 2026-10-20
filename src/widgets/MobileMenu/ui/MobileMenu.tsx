import {
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemText,
  useTheme,
  useMediaQuery,
  Divider,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useState } from 'react';
import { navItems } from '../model/navItems';
import { Link as RouterLink } from 'react-router';
import { selectUser } from 'entities/User';
import { useSelector } from 'react-redux';
import { LogoutButton } from 'features/Authorization/ui/LogoutButton';
import { AuthButton } from 'features/Authorization/ui/AuthButton';
import { classificationPreviewEnabled, CLASSIFICATION_PREVIEW_PATH } from 'shared/config/classificationPreview';

export const MobileMenu = () => {
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const user = useSelector(selectUser);
  const visibleItems = navItems.filter((item) => user || (classificationPreviewEnabled && item.path === CLASSIFICATION_PREVIEW_PATH));

  const toggleDrawer = (value: boolean) => () => setOpen(value);

  const drawerContent = (
    <Box
      sx={{ width: 250, display: 'flex', flexDirection: 'column', p: 2 }}
      onClick={toggleDrawer(false)}
      onKeyDown={toggleDrawer(false)}
    >
      {visibleItems.length > 0 && (
        <>
          <List>
            {visibleItems.map((item) => (
              <ListItem
                role="button"
                component={RouterLink}
                to={item.path}
                key={item.label}
              >
                <ListItemText primary={item.label} />
              </ListItem>
            ))}
          </List>

          <Divider sx={{ my: 2 }} />
        </>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {user ? <LogoutButton /> : <AuthButton />}
      </Box>
    </Box>
  );

  if (!isMobile) return null;

  return (
    <>
      <IconButton
        aria-label="Открыть меню"
        color="inherit"
        edge="start"
        onClick={toggleDrawer(true)}
      >
        <MenuIcon />
      </IconButton>
      <Drawer
        anchor="right"
        open={open}
        onClose={toggleDrawer(false)}
      >
        {drawerContent}
      </Drawer>
    </>
  );
};
