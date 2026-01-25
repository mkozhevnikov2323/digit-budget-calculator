import { ExpenseSchema } from '../model/types';

export interface LoanGroup {
  recipient: string;
  totalAmount: number;
  loans: ExpenseSchema[];
}

export const groupLoansByRecipient = (
  expenses: ExpenseSchema[],
): LoanGroup[] => {
  const map = new Map<string, ExpenseSchema[]>();

  for (const exp of expenses) {
    const key = exp.recipient || 'Без получателя';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(exp);
  }

  return Array.from(map.entries()).map(([recipient, loans]) => ({
    recipient,
    totalAmount: loans.reduce((sum, l) => sum + l.amount, 0),
    loans: loans.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    ),
  }));
};
