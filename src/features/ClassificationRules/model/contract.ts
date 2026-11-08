import type { FinancialLayer } from 'features/FinancialClassification/model/types';
import { canonicalId, closedData, stableAssignment, type StableRole } from 'features/HistoricalClassification/model/contract';

type BaseRule = { _id: string; owner: string; enabled: boolean; createdAt: string; updatedAt: string };
export type ClassificationRule = BaseRule & (
  | { dataset: 'expenses'; category: string; title?: string; economicRole: 'ordinary_expense'; layer: FinancialLayer }
  | { dataset: 'incomes'; source: string; economicRole: Exclude<StableRole, 'ordinary_expense' | 'loan_issuance'>; layer: null }
);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
/** Validate the GET envelope and owner before any rule can enter the client cache. */
export const readClassificationRules = (input: unknown, owner: string): ClassificationRule[] | null => {
  const response = closedData(input, ['rules']);
  if (!response || !Array.isArray(response.rules)) return null;
  const rules: ClassificationRule[] = [], ids = new Set<string>();
  for (const inputRule of response.rules) {
    const r = closedData(inputRule, ['_id', 'owner', 'dataset', 'enabled', 'category', 'title', 'source', 'economicRole', 'layer', 'createdAt', 'updatedAt']);
    if (!r || !canonicalId(r._id) || ids.has(r._id) || r.owner !== owner || typeof r.enabled !== 'boolean'
      || typeof r.createdAt !== 'string' || !Number.isFinite(Date.parse(r.createdAt))
      || typeof r.updatedAt !== 'string' || !Number.isFinite(Date.parse(r.updatedAt))
      || Date.parse(r.createdAt) > Date.parse(r.updatedAt) || (r.dataset !== 'expenses' && r.dataset !== 'incomes')) return null;
    const assignment = stableAssignment({ economicRole: r.economicRole, layer: r.layer }, r.dataset);
    if (!assignment) return null;
    const base = { _id: r._id, owner, enabled: r.enabled, createdAt: r.createdAt, updatedAt: r.updatedAt };
    if (r.dataset === 'expenses') {
      if (!text(r.category) || Object.prototype.hasOwnProperty.call(r, 'source') || assignment.economicRole !== 'ordinary_expense'
        || assignment.layer === null || (Object.prototype.hasOwnProperty.call(r, 'title') && !text(r.title))) return null;
      rules.push({ ...base, dataset: 'expenses', category: r.category, ...(typeof r.title === 'string' ? { title: r.title } : {}),
        economicRole: 'ordinary_expense', layer: assignment.layer });
    } else {
      if (!text(r.source) || Object.prototype.hasOwnProperty.call(r, 'category') || Object.prototype.hasOwnProperty.call(r, 'title') || assignment.layer !== null
        || assignment.economicRole === 'ordinary_expense' || assignment.economicRole === 'loan_issuance') return null;
      rules.push({ ...base, dataset: 'incomes', source: r.source, economicRole: assignment.economicRole, layer: null });
    }
    ids.add(r._id);
  }
  return rules;
};

export const INCOME_RULE_ROLES = ['ordinary_income', 'loan_repayment', 'refund', 'internal_transfer', 'capital_movement'] as const;
export type IncomeRuleRole = typeof INCOME_RULE_ROLES[number];
export type RuleInput = { enabled: boolean } & (
  | { dataset: 'expenses'; category: string; title?: string; economicRole: 'ordinary_expense'; layer: FinancialLayer }
  | { dataset: 'incomes'; source: string; economicRole: IncomeRuleRole; layer: null }
);
export type RuleChange = { dataset?: 'expenses' | 'incomes'; enabled?: boolean; category?: string; title?: string | null;
  source?: string; economicRole?: RuleInput['economicRole']; layer?: FinancialLayer | null };
/** Unknown failures must never be interpreted as proof that nothing was stored. */
export const ruleWriteFailure = (error: unknown): { unknown: boolean; message: string } | null => {
  if (!error) return null;
  const status = typeof error === 'object' && 'status' in error ? error.status : undefined;
  const data = typeof error === 'object' && 'data' in error ? error.data : undefined;
  const unapplied = !!data && typeof data === 'object' && 'persistence' in data && data.persistence === 'not_applied';
  const code = typeof status === 'number' ? status : 0;
  const uncertain = !!data && typeof data === 'object' && 'persistence' in data && data.persistence === 'unknown';
  const unknown = uncertain || ![400, 401, 403, 404, 409].includes(code) && !unapplied;
  const messages: Record<number, string> = { 400: 'Проверьте поля правила.', 409: 'Такое правило уже существует.', 503: 'Сервис правил временно недоступен.' };
  const message = data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
    ? data.message.slice(0, 300) : messages[code] ?? 'Не удалось сохранить изменение.';
  return { unknown, message: `${message}${typeof status === 'number' ? ` (${status})` : ''}${unknown ? ' Результат записи неизвестен. Обновите список перед следующей записью.' : ''}` };
};
