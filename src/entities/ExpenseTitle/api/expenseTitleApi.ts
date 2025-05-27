import { baseApi } from 'shared/api/baseApi';

export const expenseTitleApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getExpenseTitles: builder.query<string[], void>({
      query: () => '/expenseTitles',
      providesTags: ['ExpenseTitles'],
    }),
    addExpenseTitle: builder.mutation<void, string>({
      query: (newRecipient) => ({
        url: '/expenseTitles',
        method: 'POST',
        body: { name: newRecipient },
      }),
      invalidatesTags: ['ExpenseTitles'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetExpenseTitlesQuery, useAddExpenseTitleMutation } =
  expenseTitleApi;
