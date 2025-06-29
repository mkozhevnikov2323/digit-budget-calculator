export interface ExpenseSchema {
  id: string | number;
  amount: number;
  date: string; // ISO-строка
  title: string;
  recipient: string;
  category: string;
  comment?: string;

  [key: string]: string | number | undefined;
}

export interface ExpenseState {
  list: ExpenseSchema[] | null;
}
