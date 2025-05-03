import React from 'react';
import { BrowserRouter } from 'react-router';

interface AppProvidersProps {
  children: React.ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return <BrowserRouter>{children}</BrowserRouter>;
};
