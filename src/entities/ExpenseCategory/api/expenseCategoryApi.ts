import { baseApi } from 'shared/api/baseApi';

export const expenseCategoryApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCategories: builder.query<string[], void>({
      query: () => '/categories',
    }),
    addCategory: builder.mutation<void, string>({
      query: (newCategory) => ({
        url: '/categories',
        method: 'POST',
        body: { name: newCategory },
      }),
    }),
  }),
  overrideExisting: false,
});

export const { useGetCategoriesQuery, useAddCategoryMutation } =
  expenseCategoryApi;
