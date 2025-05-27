import { baseApi } from 'shared/api/baseApi';

export const recipientApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getRecipients: builder.query<string[], void>({
      query: () => '/recipients',
      providesTags: ['Recipients'],
    }),
    addRecipient: builder.mutation<void, string>({
      query: (newRecipient) => ({
        url: '/recipients',
        method: 'POST',
        body: { name: newRecipient },
      }),
      invalidatesTags: ['Recipients'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetRecipientsQuery, useAddRecipientMutation } = recipientApi;
