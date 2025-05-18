import React from 'react';
import { BrowserRouter } from 'react-router';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from './store/store';
import { UserProvider } from 'entities/User';

interface AppProvidersProps {
  children: React.ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <BrowserRouter>
      <ReduxProvider store={store}>
        <UserProvider>{children}</UserProvider>
      </ReduxProvider>
    </BrowserRouter>
  );
};
