export { incomeSourceReducer } from './model/sourceSlice';

export type { SourceSchema } from './model/types';

export {
  useGetDefaultSourcesQuery,
  useGetUserSourcesQuery,
  useAddUserSourceMutation,
} from './api/sourceApi';
