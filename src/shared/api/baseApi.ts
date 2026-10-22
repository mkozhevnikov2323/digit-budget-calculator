import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { withSessionBoundary } from './sessionBaseQuery';

export const apiBaseUrl: string = import.meta.env.VITE_API_URL;
const baseQuery = withSessionBoundary(fetchBaseQuery({
  baseUrl: apiBaseUrl,
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
