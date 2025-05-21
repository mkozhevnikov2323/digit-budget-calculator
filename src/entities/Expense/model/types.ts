export interface ExpenseSchema {
  id: string;
  amount: number;
  date: string; // ISO-строка
  title: string;
  recipient: string;
  category: string;
  comment?: string | null;
}

export interface ExpenseState {
  list: ExpenseSchema[] | null;
}
