import { baseApi } from 'shared/api/baseApi';
import { ExpenseCategorySchema } from '../model/types';

export const expenseCategoryApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDefaultCategories: builder.query<ExpenseCategorySchema[], void>({
      query: () => '/categories/default',
      providesTags: ['ExpenseCategory'],
    }),
    getUserCategories: builder.query<ExpenseCategorySchema[], void>({
      query: () => '/categories/user',
      providesTags: ['ExpenseCategory'],
    }),
    addUserCategory: builder.mutation<ExpenseCategorySchema, { name: string }>({
      query: (body) => ({
        url: '/categories/user',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['ExpenseCategory'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetDefaultCategoriesQuery,
  useGetUserCategoriesQuery,
  useAddUserCategoryMutation,
} = expenseCategoryApi;
