export interface ExpenseSchema {
  _id: string;
  amount: number;
  date: string; // ISO-строка
  title: string;
  recipient: string;
  category: string;
  comment?: string;
  createdAt?: string;
  updatedAt?: string;
  __v?: number;

  [key: string]: string | number | undefined;
}

export interface ExpenseQueryPapams {
  year?: number;
  month?: number;
  page?: number;
  limit?: number;
}

export interface ExpenseResponse {
  total: number;
  page: number;
  limit: number;
  expenses: ExpenseSchema[];
}

export interface ExpenseState {
  list: ExpenseSchema[] | null;
  // Pagination
  total: number;
  page: number;
  limit: number;
  // Query
  year: number;
  month: number;
}
