import { RootState } from 'app/providers/store/store';

export const selectExpensesState = (state: RootState) => state.expenses;

export const selectExpenseById = (id: string) => (state: RootState) => {
  return state.expenses.list?.find((expense) => expense._id === id);
};
