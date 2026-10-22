/** @jest-environment node */
import { stableAssignment, validateClassificationRead } from '../contract';
import { validateOwnedHistory } from '../history';
import { expense, income, expenseResponse, incomeResponse, selectedPeriod } from 'features/FinancialAnalytics/model/tests/fixtures';
const id = '1'.repeat(24), owner = 'a'.repeat(24);
const dto = (extra = {}) => ({ version: 'classification-read-v1', dataset: 'expenses', operationId: id,
  status: 'approved', storedState: 'approved', decisionRevision: 1,
  confirmed: { economicRole: 'ordinary_expense', layer: 'everyday' }, consistency: 'observed_only_non_atomic', ...extra });

describe('stable C3.2 read boundary', () => {
  it.each(['everyday', 'irregular', 'emergency', 'major_goals', 'long_term_capital'])('accepts ordinary expense layer %s', layer => {
    expect(validateClassificationRead(dto({ confirmed: { economicRole: 'ordinary_expense', layer } }), 'expenses', id)?.status).toBe('approved');
  });
  it.each(['unreviewed', 'blocked', 'explicit_unclassified', 'cleared', 'stale'])('preserves exclusive status %s', status => {
    const absent = ['unreviewed', 'blocked'].includes(status);
    expect(validateClassificationRead(dto({ status, storedState: absent ? null : status === 'stale' ? 'approved' : status,
      decisionRevision: absent ? null : 1, confirmed: null }), 'expenses', id)?.status).toBe(status);
  });
  it.each([null, {}, dto({ version: 'other' }), dto({ operationId: '2'.repeat(24) }), dto({ owner }),
    dto({ confirmed: { economicRole: 'ordinary_income', layer: null } }), dto({ status: 'stale' }),
    dto({ decisionRevision: 0 }), dto({ status: 'unreviewed', storedState: null, decisionRevision: null }),
    dto({ confirmed: { economicRole: 'ordinary_expense', layer: 'invented' } })])('rejects malformed or mismatched DTO %#', value => {
    expect(validateClassificationRead(value, 'expenses', id)).toBeNull();
  });
  it('rejects accessors and prototypes without invoking hooks', () => {
    const hook = jest.fn(() => { throw Error('fictional private marker'); });
    expect(validateClassificationRead(Object.defineProperty(dto(), 'confirmed', { enumerable: true, get: hook }), 'expenses', id)).toBeNull();
    expect(validateClassificationRead(Object.create(dto()), 'expenses', id)).toBeNull(); expect(hook).not.toHaveBeenCalled();
  });
  it('does not alias provisional roles or infer from categories', () => {
    expect(stableAssignment({ economicRole: 'unknown', layer: null }, 'expenses')).toBeNull();
    expect(stableAssignment({ economicRole: 'ordinary_income', layer: 'everyday' }, 'incomes')).toBeNull();
    expect(stableAssignment({ economicRole: 'loan_issuance', layer: null }, 'expenses')).not.toBeNull();
  });
});
describe('complete owner-scoped historical facts', () => {
  const e = () => ({ ...expense(id), owner }), i = () => ({ ...income(id), owner });
  it('preserves both datasets, full exact strings and absent/null/empty comments', () => {
    for (const comment of [undefined, null, '']) {
      const r = e(); if (comment !== undefined) Object.assign(r, { comment });
      const result = validateOwnedHistory(expenseResponse([r]), incomeResponse([i()]), selectedPeriod(), owner);
      expect(result.ok).toBe(true); if (result.ok) {
        expect(result.value.operations).toHaveLength(2);
        expect(Object.prototype.hasOwnProperty.call(result.value.operations[0].facts, 'comment')).toBe(comment !== undefined);
      }
    }
  });
  it.each([expenseResponse([{ ...e(), owner: 'b'.repeat(24) }]), expenseResponse([e()], { total: 2 }),
    expenseResponse([e(), e()]), expenseResponse([{ ...e(), amount: 1.005 }])])('rejects owner mismatch/incomplete/duplicate/precision case %#', value => {
    expect(validateOwnedHistory(value, incomeResponse(), selectedPeriod(), owner).ok).toBe(false);
  });
});
