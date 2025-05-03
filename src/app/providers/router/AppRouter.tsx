import { Suspense } from 'react';
import { Route, Routes } from 'react-router';

import { routeConfig } from './routeConfig';

const AppRouter = () => (
  <Routes>
    {Object.values(routeConfig).map(({ element, path }) => (
      <Route
        key={path}
        element={
          <Suspense fallback={<div>Loading...</div>}>{element}</Suspense>
        }
        path={path}
      />
    ))}
  </Routes>
);

export default AppRouter;
