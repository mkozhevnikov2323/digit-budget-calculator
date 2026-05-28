export {
  selectAllIncomes,
  selectIncomePagination,
  selectIncomeFilters,
  selectIncomeById,
} from './model/selectors';

export { useSyncIncomesWithStore } from './hooks/useSyncIncomeWithStore';

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

export {
  setIncome,
  setYear,
  setMonth,
  setPage,
  resetIncome,
  reducer as incomeReducer,
} from './model/incomeSlice';
