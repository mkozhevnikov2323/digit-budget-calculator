export type ExpenseFormValues = {
  amount: number;
  date: string;
  title: string;
  category: string;
  recipient: string;
  comment?: string;
};

export type ExpenseDraft = Partial<ExpenseFormValues>;
