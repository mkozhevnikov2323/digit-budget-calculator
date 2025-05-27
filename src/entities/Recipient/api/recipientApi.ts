import { baseApi } from 'shared/api/baseApi';
import { RecipientSchema } from '../model/types';

export const recipientApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getRecipients: builder.query<RecipientSchema[], void>({
      query: () => '/recipients',
      providesTags: ['Recipients'],
    }),
    addRecipient: builder.mutation<RecipientSchema, { name: string }>({
      query: (body) => ({
        url: '/recipients',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Recipients'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetRecipientsQuery, useAddRecipientMutation } = recipientApi;
