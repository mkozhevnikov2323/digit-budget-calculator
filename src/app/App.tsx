import React from 'react';
import AppRouter from 'app/providers/router/AppRouter';
import { Navbar } from 'widgets/Navbar';
import { InitAuth } from 'app/providers/init/InitAuth';

export const App: React.FC = (): React.ReactNode => {
  return (
    <>
      <InitAuth />
      <Navbar />
      <AppRouter />
    </>
  );
};

export default App;
