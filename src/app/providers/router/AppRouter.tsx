import { Suspense } from 'react';
import { useRoutes } from 'react-router';

import { routeConfig, classificationPreviewRoutes } from './routeConfig';

const AppRouter = () => {
  const routes = useRoutes([...Object.values(routeConfig), ...classificationPreviewRoutes]);
  return <Suspense fallback={<div role="status">Загрузка страницы…</div>}>{routes}</Suspense>;
};

export default AppRouter;
