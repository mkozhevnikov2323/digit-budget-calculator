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
