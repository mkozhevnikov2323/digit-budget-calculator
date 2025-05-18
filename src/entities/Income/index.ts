export { incomeApi } from './api/incomeApi';

export type { IncomeSchema } from './model/types';

export {
  useAddIncomeMutation,
  useAddSourceMutation,
  useGetSourcesQuery,
} from './api/incomeApi';

export { IncomeTable } from './ui/IncomeTable';

export {
  setIncome,
  resetIncome,
  reducer as incomeReducer,
} from './model/incomeSlice';
