import { RoutePath } from 'app/providers/router/routeConfig';
import { classificationPreviewEnabled, CLASSIFICATION_PREVIEW_PATH } from 'shared/config/classificationPreview';

export interface NavItem {
  label: string;
  path: string;
}

export const navItems: NavItem[] = [
  { label: 'Доходы', path: RoutePath.income },
  { label: 'Расходы', path: RoutePath.expenses },
  { label: 'Займы', path: RoutePath.loans },
  { label: 'Баланс', path: RoutePath.balance },
  { label: 'Аналитика', path: RoutePath.analytics },
  ...(classificationPreviewEnabled ? [{ label: 'Классификация (демо)', path: CLASSIFICATION_PREVIEW_PATH }] : []),
  { label: 'Профиль', path: RoutePath.profile },
];
