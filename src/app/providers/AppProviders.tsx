import React from 'react';
import { BrowserRouter } from 'react-router';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from './store/store';

interface AppProvidersProps {
  children: React.ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <BrowserRouter>
      <ReduxProvider store={store}>{children}</ReduxProvider>
    </BrowserRouter>
  );
};
