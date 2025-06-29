import React from 'react';
import { BrowserRouter } from 'react-router';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from './store/store';
import { UserProvider } from 'entities/User';
import { AppThemeProvider } from './theme/AppThemProvider';

interface AppProvidersProps {
  children: React.ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <BrowserRouter>
      <ReduxProvider store={store}>
        <AppThemeProvider>
          <UserProvider>{children}</UserProvider>
        </AppThemeProvider>
      </ReduxProvider>
    </BrowserRouter>
  );
};
