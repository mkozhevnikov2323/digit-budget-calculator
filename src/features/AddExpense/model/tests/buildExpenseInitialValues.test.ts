import { buildExpenseInitialValues } from '../buildExpenseInitialValues';
import type { ExpenseDraft } from '../types';

const today = '2026-09-20';

const defaultValues = {
  amount: 0,
  date: today,
  title: '',
  category: '',
  recipient: '',
  comment: '',
};

describe('buildExpenseInitialValues', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(`${today}T12:00:00.000Z`));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('returns the existing form defaults without a draft', () => {
    expect(buildExpenseInitialValues()).toEqual(defaultValues);
  });

  it('merges a partial draft with safe defaults', () => {
    expect(
      buildExpenseInitialValues({
        amount: 450.75,
        title: 'Продукты',
      }),
    ).toEqual({
      ...defaultValues,
      amount: 450.75,
      title: 'Продукты',
    });
  });

  it('does not let undefined fields overwrite safe defaults', () => {
    const draft: ExpenseDraft = {
      amount: undefined,
      date: undefined,
      title: undefined,
      category: undefined,
      recipient: undefined,
      comment: undefined,
    };

    expect(buildExpenseInitialValues(draft)).toEqual(defaultValues);
  });

  it.each([0, 125.5])('preserves a valid amount: %s', (amount) => {
    expect(buildExpenseInitialValues({ amount }).amount).toBe(amount);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1])(
    'falls back to the default amount for an invalid amount: %s',
    (amount) => {
      expect(buildExpenseInitialValues({ amount }).amount).toBe(0);
    },
  );

  it('preserves a valid date in YYYY-MM-DD format', () => {
    expect(buildExpenseInitialValues({ date: '2024-02-29' }).date).toBe(
      '2024-02-29',
    );
  });

  it.each(['', 'not-a-date', '2025-02-29', '2024-13-01', '2024-01-32'])(
    'falls back to today for an invalid date: %s',
    (date) => {
      expect(buildExpenseInitialValues({ date }).date).toBe(today);
    },
  );

  it('preserves valid text fields', () => {
    expect(
      buildExpenseInitialValues({
        title: 'Кофе',
        category: 'Еда',
        recipient: 'Кофейня',
        comment: 'Завтрак',
      }),
    ).toEqual({
      ...defaultValues,
      title: 'Кофе',
      category: 'Еда',
      recipient: 'Кофейня',
      comment: 'Завтрак',
    });
  });

  it('does not mutate the input draft', () => {
    const draft: ExpenseDraft = {
      amount: 99,
      date: '2024-05-10',
      title: 'Билет',
      category: 'Транспорт',
      recipient: 'Метро',
      comment: 'Поездка',
    };
    const snapshot = { ...draft };

    buildExpenseInitialValues(Object.freeze(draft));

    expect(draft).toEqual(snapshot);
  });
});
