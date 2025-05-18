import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { IncomeSchema } from '../model/types';

export const incomeApi = createApi({
  reducerPath: 'incomeApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Income'],
  endpoints: (builder) => ({
    getIncomes: builder.query<IncomeSchema[], void>({
      query: () => '/incomes',
      providesTags: ['Income'],
    }),
    addIncome: builder.mutation<void, Omit<IncomeSchema, 'id'>>({
      query: (newIncome) => ({
        url: '/incomes',
        method: 'POST',
        body: newIncome,
      }),
      invalidatesTags: ['Income'],
    }),
    getSources: builder.query<string[], void>({
      query: () => '/sources',
    }),
    addSource: builder.mutation<void, string>({
      query: (newSource) => ({
        url: '/sources',
        method: 'POST',
        body: { name: newSource },
      }),
    }),
  }),
});

export const {
  useGetIncomesQuery,
  useAddIncomeMutation,
  useGetSourcesQuery,
  useAddSourceMutation,
} = incomeApi;
