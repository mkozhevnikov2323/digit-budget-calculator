import { RootState } from 'app/providers/store/store';

export const selectIsOpenExpenseModal = (state: RootState) =>
  state.expenseModal.open;
