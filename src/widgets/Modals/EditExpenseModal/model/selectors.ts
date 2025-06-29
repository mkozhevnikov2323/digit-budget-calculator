import { RootState } from 'app/providers/store/store';
export const selectIsOpenEditExpenseModal = (state: RootState) =>
  state.editExpenseModal.open;
