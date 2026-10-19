import { FINANCIAL_LAYERS, type ClassificationAssignment, type EconomicRole, type FinancialLayer } from '../model/types';

export const layerLabels: Record<FinancialLayer, string> = {
  everyday: 'Повседневные расходы', irregular: 'Нерегулярные обязательства', emergency: 'Чрезвычайный резерв',
  major_goals: 'Крупные цели', long_term_capital: 'Долгосрочный капитал',
};
export const roleLabels: Record<EconomicRole, string> = {
  unknown: 'Не определена', ordinary_expense: 'Обычный расход', ordinary_income: 'Обычное поступление',
  loan_issuance: 'Выдача займа', loan_repayment: 'Возврат займа', refund: 'Возврат покупки',
  internal_transfer: 'Внутренний перевод', capital_movement: 'Движение капитала',
};
/** Presentation options only. The existing resolver remains authoritative and
 * checks every submitted assignment through reviewSession. No inference here. */
export const manualOptions = (dataset: 'expenses' | 'incomes') => {
  const roles: Exclude<ClassificationAssignment['economicRole'], 'ordinary_expense'>[] = dataset === 'expenses'
    ? ['loan_issuance', 'internal_transfer', 'capital_movement']
    : ['ordinary_income', 'loan_repayment', 'refund', 'internal_transfer', 'capital_movement'];
  return [
    ...(dataset === 'expenses' ? FINANCIAL_LAYERS.map((layer) => ({ key: layer,
      label: `Обычный расход — ${layerLabels[layer]}`, assignment: { economicRole: 'ordinary_expense' as const, layer } })) : []),
    ...roles.map((economicRole) => ({ key: economicRole, label: roleLabels[economicRole], assignment: { economicRole, layer: null } })),
  ];
};
