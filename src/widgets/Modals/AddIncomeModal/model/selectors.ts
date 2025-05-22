import { RootState } from 'app/providers/store/store';

export const selectIsOpenIncomeModal = (state: RootState) =>
  state.incomeModal.open;
