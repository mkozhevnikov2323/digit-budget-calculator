export interface IncomeSchema {
  _id: string;
  date: string;
  amount: number;
  source: string;
  category?: string;
  comment?: string;
  createdAt?: string;
  updatedAt?: string;
  __v?: number;

  [key: string]: string | number | undefined;
}

export interface IncomeQueryParams {
  year?: number;
  month?: number;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  noPagination?: boolean;
  source?: string;
}

export interface IncomeResponse {
  total: number;
  page: number;
  limit: number;
  incomes: IncomeSchema[];
}

export interface IncomeState {
  list: IncomeSchema[] | null;
  // Pagination
  total: number;
  page: number;
  limit: number;
  // Filters
  year: number;
  month: number;
}
