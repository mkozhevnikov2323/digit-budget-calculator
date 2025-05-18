import { baseApi } from 'shared/api/baseApi';

interface User {
  email: string;
}

export const userApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMe: builder.query<User, void>({
      query: () => ({
        url: '/users/me',
      }),
      providesTags: ['User'],
    }),
  }),
});

export const { useGetMeQuery } = userApi;
