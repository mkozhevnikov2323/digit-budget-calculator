export { groupLoansByRecipient } from './lib/groupLoansByRecipient';

export { useLoanIssuedExpenses } from './hooks/useLoanIssuedExpenses';
export { useSyncExpensesWithStore } from './hooks/useSyncExpensesWithStore';

export { selectExpenseById, selectExpensesState } from './model/selectors';

export { BarChartExpensesByCategory } from './ui/BarChartExpensesByCategory';
export { LineChartExpensesByCategory } from './ui/LineChartExpensesByCategory';
export { LineChartExpenses } from './ui/LineChartExpenses';

export {
  useGetExpensesQuery,
  useAddExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
  useGetMonthlySummaryQuery,
} from './api/expenseApi';

export type { ExpenseSchema } from './model/types';
export type { LoanGroup } from './lib/groupLoansByRecipient';

export {
  setExpenses,
  setPage,
  setYear,
  setMonth,
  resetExpenses,
  reducer as expenseReducer,
} from './model/expenseSlice';
