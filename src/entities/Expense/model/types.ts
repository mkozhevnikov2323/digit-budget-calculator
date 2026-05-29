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
  startDate?: string;
  endDate?: string;
  noPagination?: boolean;
  title?: string;
  recipient?: string;
  category?: string;
}

export interface MonthlySummaryQuery {
  year?: number;
  month?: number;
  startDate?: string;
  endDate?: string;
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

export type LoanOperationType = 'issued' | 'returned';

export interface LoanOperation {
  _id: string;
  date: string;
  amount: number;
  type: LoanOperationType;
  title?: string;
  comment?: string;
  source?: string;
}

export interface LoanGroup {
  recipient: string;
  totalAmount: number;
  operations: LoanOperation[];
}
