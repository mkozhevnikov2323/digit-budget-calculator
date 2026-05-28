import { baseApi } from 'shared/api/baseApi';
import type {
  IncomeSchema,
  IncomeResponse,
  IncomeQueryParams,
} from '../model/types';

export const incomeApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getIncomes: builder.query<IncomeResponse, IncomeQueryParams | void>({
      query: (params) => {
        if (!params) return '/incomes';

        const queryParams = new URLSearchParams();

        if (params.year) queryParams.append('year', String(params.year));
        if (params.month) queryParams.append('month', String(params.month));
        if (params.page) queryParams.append('page', String(params.page));
        if (params.limit) queryParams.append('limit', String(params.limit));
        if (params.startDate) queryParams.append('startDate', params.startDate);
        if (params.endDate) queryParams.append('endDate', params.endDate);
        if (params.source) queryParams.append('source', params.source);
        if (params.noPagination) queryParams.append('noPagination', 'true');

        return `/incomes?${queryParams.toString()}`;
      },
      providesTags: ['Income'],
    }),

    addIncome: builder.mutation<void, Omit<IncomeSchema, '_id'>>({
      query: (newIncome) => ({
        url: '/incomes',
        method: 'POST',
        body: newIncome,
      }),
      invalidatesTags: ['Income', 'Balance'],
    }),

    updateIncome: builder.mutation<void, IncomeSchema>({
      query: ({ _id, ...data }) => ({
        url: `/incomes/${_id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['Income'],
    }),

    deleteIncome: builder.mutation<void, { id: string }>({
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
