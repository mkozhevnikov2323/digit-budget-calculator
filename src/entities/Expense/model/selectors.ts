import { RootState } from 'app/providers/store/store';

export const selectAllExpenses = (state: RootState) => state.expenses.list;

export const selectExpenseById =
  (id: string | number) => (state: RootState) => {
    return state.expenses.list?.find((expense) => expense._id === id);
  };
