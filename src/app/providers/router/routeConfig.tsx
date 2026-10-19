import { RouteObject } from 'react-router';
import { lazy } from 'react';
import { classificationPreviewEnabled, CLASSIFICATION_PREVIEW_PATH } from 'shared/config/classificationPreview';

import { MainPage } from 'pages/MainPage';
import { IncomePage } from 'pages/IncomePage';
import { ExpensesPage } from 'pages/ExpensesPage';
import { BalancePage } from 'pages/BalancePage';
import { ProfilePage } from 'pages/ProfilePage';
import { NotFoundPage } from 'pages/NotFoundPage';
import { Protected } from './ProtectedRoute';
import { LoansPage } from 'pages/LoansPage';
import { AnalyticsPage } from 'pages/AnalyticsPage';

// The production literal is false, including builds in development mode. Keep
// the dynamic import inside the guard so no demo chunk is shipped by build.
const ClassificationPreviewPage = classificationPreviewEnabled
  ? lazy(() => import('pages/ClassificationPreviewPage/ui/ClassificationPreviewPage')) : null;
export const classificationPreviewRoutes: RouteObject[] = ClassificationPreviewPage
  ? [{ path: CLASSIFICATION_PREVIEW_PATH, element: <ClassificationPreviewPage /> }] : [];

export const enum AppRoutes {
  MAIN = 'main',
  INCOME = 'income',
  EXPENSES = 'expenses',
  BALANCE = 'balance',
  LOANS = 'loans',
  ANALYTICS = 'analytics',
  PROFILE = 'profile',
  NOT_FOUND = 'notFound',
}

export const RoutePath: Record<AppRoutes, string> = {
  [AppRoutes.MAIN]: '/',
  [AppRoutes.INCOME]: '/income',
  [AppRoutes.EXPENSES]: '/expenses',
  [AppRoutes.BALANCE]: '/balance',
  [AppRoutes.LOANS]: '/loans',
  [AppRoutes.ANALYTICS]: '/analytics',
  [AppRoutes.PROFILE]: '/profile',
  [AppRoutes.NOT_FOUND]: '*',
};

export const routeConfig: Record<AppRoutes, RouteObject> = {
  [AppRoutes.ANALYTICS]: {
    path: RoutePath.analytics,
    element: <Protected><AnalyticsPage /></Protected>,
  },
  [AppRoutes.MAIN]: {
    path: RoutePath.main,
    element: <MainPage />,
  },
  [AppRoutes.INCOME]: {
    path: RoutePath.income,
    element: (
      <Protected>
        <IncomePage />
      </Protected>
    ),
  },
  [AppRoutes.EXPENSES]: {
    path: RoutePath.expenses,
    element: (
      <Protected>
        <ExpensesPage />
      </Protected>
    ),
  },
  [AppRoutes.BALANCE]: {
    path: RoutePath.balance,
    element: (
      <Protected>
        <BalancePage />
      </Protected>
    ),
  },
  [AppRoutes.LOANS]: {
    path: RoutePath.loans,
    element: (
      <Protected>
        <LoansPage />
      </Protected>
    ),
  },
  [AppRoutes.PROFILE]: {
    path: RoutePath.profile,
    element: (
      <Protected>
        <ProfilePage />
      </Protected>
    ),
  },
  [AppRoutes.NOT_FOUND]: {
    path: RoutePath.notFound,
    element: <NotFoundPage />,
  },
};
