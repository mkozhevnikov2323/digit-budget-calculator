import { RootState } from 'app/providers/store/store';

export const selectAllIncomes = (state: RootState) => state.income.list;

export const selectIncomeById = (id: string) => (state: RootState) => {
  return state.income.list?.find((income) => income._id === id);
};
