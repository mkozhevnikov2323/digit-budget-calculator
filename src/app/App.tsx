import React from 'react';
import AppRouter from 'app/providers/router/AppRouter';
import { Navbar } from 'widgets/Navbar';

export const App: React.FC = (): React.ReactNode => {
  return (
    <>
      <Navbar />
      <AppRouter />
    </>
  );
};

export default App;
