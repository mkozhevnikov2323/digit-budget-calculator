import { ThemeProvider } from '@mui/material/styles';
import { appTheme } from 'shared/theme';

interface Props {
  children: React.ReactNode;
}

export const AppThemeProvider: React.FC<Props> = ({ children }) => {
  return <ThemeProvider theme={appTheme}>{children}</ThemeProvider>;
};
