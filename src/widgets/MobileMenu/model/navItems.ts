import { RoutePath } from 'app/providers/router/routeConfig';

export interface NavItem {
  label: string;
  path: string;
}

export const navItems: NavItem[] = [
  { label: 'Доходы', path: RoutePath.income },
  { label: 'Расходы', path: RoutePath.expenses },
  { label: 'Баланс', path: RoutePath.balance },
  { label: 'Профиль', path: RoutePath.profile },
];
