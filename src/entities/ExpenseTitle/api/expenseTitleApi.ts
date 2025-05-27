import { baseApi } from 'shared/api/baseApi';
import { ExpenseTitleSchema } from '../model/types';

export const expenseTitleApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getExpenseTitles: builder.query<ExpenseTitleSchema[], void>({
      query: () => '/expenseTitles',
      providesTags: ['ExpenseTitles'],
    }),
    addExpenseTitle: builder.mutation<ExpenseTitleSchema, { name: string }>({
      query: (body) => ({
        url: '/expenseTitles',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['ExpenseTitles'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetExpenseTitlesQuery, useAddExpenseTitleMutation } =
  expenseTitleApi;
