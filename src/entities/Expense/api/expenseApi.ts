import { baseApi } from 'shared/api/baseApi';
import { ExpenseSchema } from '../model/types';

export const expenseApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getExpenses: builder.query<ExpenseSchema[], void>({
      query: () => '/expenses',
      providesTags: ['Expense'],
    }),
    addExpense: builder.mutation<void, Omit<ExpenseSchema, 'id'>>({
      query: (newExpense) => ({
        url: '/expenses',
        method: 'POST',
        body: newExpense,
      }),
      invalidatesTags: ['Expense'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetExpensesQuery, useAddExpenseMutation } = expenseApi;
