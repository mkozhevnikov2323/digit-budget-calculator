import { groupLoansByRecipient } from '../groupLoansByRecipient';
import type { ExpenseSchema } from '../../model/types';

const makeExpense = (
  overrides: Partial<ExpenseSchema> = {},
): ExpenseSchema => ({
  _id: 'expense-1',
  amount: 100,
  date: '2026-01-01T00:00:00.000Z',
  title: 'Loan',
  recipient: 'Alice',
  category: 'Loan issued',
  ...overrides,
});

describe('groupLoansByRecipient', () => {
  it('returns an empty array when no expenses are provided', () => {
    expect(groupLoansByRecipient([])).toEqual([]);
  });

  it('groups expenses by recipient and calculates each total amount', () => {
    const expenses = [
      makeExpense({ _id: 'alice-1', recipient: 'Alice', amount: 100 }),
      makeExpense({ _id: 'bob-1', recipient: 'Bob', amount: 75 }),
      makeExpense({ _id: 'alice-2', recipient: 'Alice', amount: 50 }),
    ];

    const result = groupLoansByRecipient(expenses);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ recipient: 'Alice', totalAmount: 150 });
    expect(result[0].loans).toHaveLength(2);
    expect(result[1]).toMatchObject({ recipient: 'Bob', totalAmount: 75 });
    expect(result[1].loans).toHaveLength(1);
  });

  it('uses the fallback group for an empty recipient', () => {
    const expense = makeExpense({ recipient: '' });

    expect(groupLoansByRecipient([expense])).toEqual([
      {
        recipient: 'Без получателя',
        totalAmount: 100,
        loans: [expense],
      },
    ]);
  });

  it('sorts loans within a group from the earliest date to the latest date', () => {
    const expenses = [
      makeExpense({ _id: 'latest', date: '2026-03-01T00:00:00.000Z' }),
      makeExpense({ _id: 'earliest', date: '2026-01-01T00:00:00.000Z' }),
      makeExpense({ _id: 'middle', date: '2026-02-01T00:00:00.000Z' }),
    ];

    const [group] = groupLoansByRecipient(expenses);

    expect(group.loans.map(({ _id }) => _id)).toEqual([
      'earliest',
      'middle',
      'latest',
    ]);
  });

  it('preserves the order in which recipients first appear', () => {
    const expenses = [
      makeExpense({ _id: 'bob-1', recipient: 'Bob' }),
      makeExpense({ _id: 'alice-1', recipient: 'Alice' }),
      makeExpense({ _id: 'bob-2', recipient: 'Bob' }),
      makeExpense({ _id: 'charlie-1', recipient: 'Charlie' }),
    ];

    expect(groupLoansByRecipient(expenses).map(({ recipient }) => recipient)).toEqual([
      'Bob',
      'Alice',
      'Charlie',
    ]);
  });

  it('treats recipient values with different casing or whitespace as distinct', () => {
    const expenses = [
      makeExpense({ _id: 'exact', recipient: 'Alice' }),
      makeExpense({ _id: 'lowercase', recipient: 'alice' }),
      makeExpense({ _id: 'trailing-space', recipient: 'Alice ' }),
      makeExpense({ _id: 'whitespace-only', recipient: '   ' }),
    ];

    expect(groupLoansByRecipient(expenses).map(({ recipient }) => recipient)).toEqual([
      'Alice',
      'alice',
      'Alice ',
      '   ',
    ]);
  });

  it('includes zero and negative amounts when calculating the total', () => {
    const expenses = [
      makeExpense({ _id: 'positive', amount: 100 }),
      makeExpense({ _id: 'zero', amount: 0 }),
      makeExpense({ _id: 'negative', amount: -40 }),
    ];

    expect(groupLoansByRecipient(expenses)[0].totalAmount).toBe(60);
  });

  it('calculates decimal totals with standard number precision', () => {
    const expenses = [
      makeExpense({ _id: 'decimal-1', amount: 0.1 }),
      makeExpense({ _id: 'decimal-2', amount: 0.2 }),
    ];

    expect(groupLoansByRecipient(expenses)[0].totalAmount).toBeCloseTo(0.3);
  });

  it('does not reorder or modify the input array', () => {
    const expenses = [
      makeExpense({ _id: 'latest', date: '2026-03-01T00:00:00.000Z' }),
      makeExpense({ _id: 'earliest', date: '2026-01-01T00:00:00.000Z' }),
    ];
    const originalExpenses = expenses.map((expense) => ({ ...expense }));

    groupLoansByRecipient(expenses);

    expect(expenses).toEqual(originalExpenses);
    expect(expenses.map(({ _id }) => _id)).toEqual(['latest', 'earliest']);
  });

  it('retains and counts duplicate expense entries', () => {
    const expense = makeExpense({ amount: 125 });

    const [group] = groupLoansByRecipient([expense, expense]);

    expect(group.totalAmount).toBe(250);
    expect(group.loans).toEqual([expense, expense]);
  });

  it('groups every provided expense without filtering by category', () => {
    const expenses = [
      makeExpense({ _id: 'loan', amount: 100, category: 'Loan issued' }),
      makeExpense({ _id: 'food', amount: 25, category: 'Food' }),
    ];

    const [group] = groupLoansByRecipient(expenses);

    expect(group.totalAmount).toBe(125);
    expect(group.loans.map(({ _id }) => _id)).toEqual(['loan', 'food']);
  });
});
