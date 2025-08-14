import { baseApi } from 'shared/api/baseApi';
import {
  ExpenseQueryPapams,
  ExpenseResponse,
  ExpenseSchema,
} from '../model/types';

export const expenseApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getExpenses: builder.query<ExpenseResponse, ExpenseQueryPapams>({
      query: ({ year, month, page = 1, limit = 20 } = {}) => {
        const params = new URLSearchParams();

        if (year) params.append('year', String(year));
        if (month) params.append('month', String(month));

        params.append('page', String(page));
        params.append('limit', String(limit));

        return `/expenses?${params.toString()}`;
      },
      providesTags: ['Expense'],
    }),
    addExpense: builder.mutation<void, Omit<ExpenseSchema, 'id'>>({
      query: (newExpense) => ({
        url: '/expenses',
        method: 'POST',
        body: newExpense,
      }),
      invalidatesTags: ['Expense', 'Balance'],
    }),
    updateExpense: builder.mutation<void, ExpenseSchema>({
      query: ({ id, ...data }) => ({
        url: `/expenses/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['Expense', 'Balance'],
    }),
    deleteExpense: builder.mutation<void, { id: string | number }>({
      query: ({ id }) => ({
        url: `/expenses/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Expense', 'Balance'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetExpensesQuery,
  useAddExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
} = expenseApi;
