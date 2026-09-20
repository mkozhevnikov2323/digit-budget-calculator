import type { ExpenseDraft } from 'features/AddExpense';

export type ExpenseRecognizer = (file: File) => Promise<ExpenseDraft>;
