import { baseApi } from 'shared/api/baseApi';
import { BalanceData } from '../model/types';

export const balanceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getBalance: builder.query<BalanceData, void>({
      query: () => '/balance',
      providesTags: ['Balance'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetBalanceQuery } = balanceApi;
