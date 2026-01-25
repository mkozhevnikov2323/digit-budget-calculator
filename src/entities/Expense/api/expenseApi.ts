import { baseApi } from 'shared/api/baseApi';
import {
  ExpenseQueryPapams,
  ExpenseResponse,
  ExpenseSchema,
  MonthlySummaryQuery,
} from '../model/types';

export const expenseApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getExpenses: builder.query<ExpenseResponse, ExpenseQueryPapams>({
      query: ({
        year,
        month,
        page,
        limit,
        startDate,
        endDate,
        title,
        recipient,
        category,
        noPagination,
      }) => {
        const params = new URLSearchParams();

        if (year) params.append('year', String(year));
        if (month) params.append('month', String(month));

        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (title) params.append('title', title);
        if (recipient) params.append('recipient', recipient);
        if (category) params.append('category', category);
        if (noPagination) params.append('noPagination', 'true');

        if (!noPagination) {
          params.append('page', String(page || 1));
          params.append('limit', String(limit || 20));
        }

        return `/expenses?${params.toString()}`;
      },
      providesTags: ['Expense'],
    }),
    getMonthlySummary: builder.query<ExpenseResponse, MonthlySummaryQuery>({
      query: ({ year, month, startDate, endDate }) => {
        const params = new URLSearchParams();

        if (year) params.append('year', String(year));
        if (month) params.append('month', String(month));
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        params.append('noPagination', 'true');
        params.append('_summary', 'true');

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
  useGetMonthlySummaryQuery,
} = expenseApi;
