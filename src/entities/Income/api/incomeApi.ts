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
    updateIncome: builder.mutation<void, IncomeSchema>({
      query: ({ id, ...data }) => ({
        url: `/incomes/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['Income'],
    }),
    deleteIncome: builder.mutation<void, { id: string | number }>({
      query: ({ id }) => ({
        url: `/incomes/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Income'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetIncomesQuery,
  useAddIncomeMutation,
  useUpdateIncomeMutation,
  useDeleteIncomeMutation,
} = incomeApi;
