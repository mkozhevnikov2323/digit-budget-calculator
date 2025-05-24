import { baseApi } from 'shared/api/baseApi';
import { SourceSchema } from '../model/types';

export const sourceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDefaultSources: builder.query<SourceSchema[], void>({
      query: () => '/sources/default',
      providesTags: ['Source'],
    }),
    getUserSources: builder.query<SourceSchema[], void>({
      query: () => '/sources/user',
      providesTags: ['Source'],
    }),
    addUserSource: builder.mutation<SourceSchema, { name: string }>({
      query: (body) => ({
        url: '/sources/user',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Source'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetDefaultSourcesQuery,
  useGetUserSourcesQuery,
  useAddUserSourceMutation,
} = sourceApi;
