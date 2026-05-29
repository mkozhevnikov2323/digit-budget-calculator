export { groupLoansByRecipient } from './lib/groupLoansByRecipient';

export { useSyncExpensesWithStore } from './hooks/useSyncExpensesWithStore';
export { useLoanHistory } from './hooks/useLoanHistory';

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

export type {
  ExpenseSchema,
  LoanOperationType,
  LoanOperation,
  LoanGroup,
} from './model/types';

export {
  setExpenses,
  setPage,
  setYear,
  setMonth,
  resetExpenses,
  reducer as expenseReducer,
} from './model/expenseSlice';
