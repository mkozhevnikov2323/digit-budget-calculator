import { RootState } from 'app/providers/store/store';

export const selectIsOpenEditIncomeModal = (state: RootState) =>
  state.editIncomeModal.open;
