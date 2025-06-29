import { createTheme } from '@mui/material/styles';

export const appTheme = createTheme({
  components: {
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: '#cfa3ff',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: '0px 5px',
        },
      },
    },
  },
});
