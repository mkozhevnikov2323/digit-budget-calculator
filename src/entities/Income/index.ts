export { selectAllIncomes, selectIncomeById } from './model/selectors';

export { useSyncIncomeWithStore } from './hooks/useSyncIncomeWithStore';

export { BarChartIncomeBySource } from './ui/BarChartIncomeBySource';

export { LineChartIncomeBySource } from './ui/LineChartIncomeBySource';

export { LineChartIncome } from './ui/LineChartIncome';

export {
  incomeApi,
  useGetIncomesQuery,
  useAddIncomeMutation,
  useUpdateIncomeMutation,
  useDeleteIncomeMutation,
} from './api/incomeApi';

export type { IncomeSchema } from './model/types';

export { IncomeTable } from './ui/IncomeTable';

export {
  setIncome,
  resetIncome,
  reducer as incomeReducer,
} from './model/incomeSlice';
