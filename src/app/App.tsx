import React from 'react';
import AppRouter from 'app/providers/router/AppRouter';

export const App: React.FC = (): React.ReactNode => {
  return (
    <>
      <AppRouter />
    </>
  );
};

export default App;
