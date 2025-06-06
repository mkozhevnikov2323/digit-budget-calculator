import { baseApi } from 'shared/api/baseApi';
import { IncomeSchema } from '../model/types';

export const incomeApi = baseApi.injectEndpoints({
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
      invalidatesTags: ['Income', 'Balance'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetIncomesQuery, useAddIncomeMutation } = incomeApi;
