import { RouteObject } from 'react-router';

import { MainPage } from 'pages/MainPage';
import { IncomePage } from 'pages/IncomePage';
import { ExpensesPage } from 'pages/ExpensesPage';
import { BalancePage } from 'pages/BalancePage';
import { ProfilePage } from 'pages/ProfilePage';
import { NotFoundPage } from 'pages/NotFoundPage';
import { Protected } from './ProtectedRoute';
import { LoansPage } from 'pages/LoansPage';

export const enum AppRoutes {
  MAIN = 'main',
  INCOME = 'income',
  EXPENSES = 'expenses',
  BALANCE = 'balance',
  LOANS = 'loans',
  PROFILE = 'profile',
  NOT_FOUND = 'notFound',
}

export const RoutePath: Record<AppRoutes, string> = {
  [AppRoutes.MAIN]: '/',
  [AppRoutes.INCOME]: '/income',
  [AppRoutes.EXPENSES]: '/expenses',
  [AppRoutes.BALANCE]: '/balance',
  [AppRoutes.LOANS]: '/loans',
  [AppRoutes.PROFILE]: '/profile',
  [AppRoutes.NOT_FOUND]: '*',
};

export const routeConfig: Record<AppRoutes, RouteObject> = {
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
