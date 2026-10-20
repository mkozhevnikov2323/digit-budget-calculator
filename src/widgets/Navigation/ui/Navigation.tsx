import { Link as RouterLink } from 'react-router';
import { useTheme, useMediaQuery, Button, Box } from '@mui/material';
import { navItems } from 'widgets/MobileMenu';
import { classificationPreviewEnabled, CLASSIFICATION_PREVIEW_PATH } from 'shared/config/classificationPreview';

export const Navigation = ({ publicOnly = false }: { publicOnly?: boolean }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  if (isMobile) return null;

  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      {navItems.filter((item) => !publicOnly || (classificationPreviewEnabled && item.path === CLASSIFICATION_PREVIEW_PATH)).map((item) => (
        <Button
          key={item.label}
          color="inherit"
          component={RouterLink}
          to={item.path}
        >
          {item.label}
        </Button>
      ))}
    </Box>
  );
};
