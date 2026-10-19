import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { withSessionBoundary } from './sessionBaseQuery';

const baseQuery = withSessionBoundary(fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL,
}));

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery,
  endpoints: () => ({}),
  tagTypes: [
    'Income',
    'User',
    'Source',
    'Expense',
    'Balance',
    'ExpenseCategory',
    'Recipients',
    'ExpenseTitles',
  ],
});
