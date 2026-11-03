/** Navigation metadata only; no shared financial state or period filter. */
export const analyticsNavigation = [
  { path: '/analytics', label: 'Расширенная аналитика' },
  { path: '/analytics/categories', label: 'Операции по категориям' },
  { path: '/analytics/recurrence', label: 'Повторяемость операций' },
  { path: '/analytics/similar', label: 'Похожие операции' },
  { path: '/analytics/income-sources', label: 'Источники поступлений' },
  { path: '/analytics/history', label: 'История операций' },
  { path: '/analytics/classification', label: 'Классификация' },
  { path: '/analytics/classification-stats', label: 'Статистика классификации' },
  { path: '/analytics/planning', label: 'Планирование бюджета' },
] as const;
