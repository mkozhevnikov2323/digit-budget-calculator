import { RootState } from 'app/providers/store/store';
import { createSelector } from '@reduxjs/toolkit';

export const selectIncomeState = (state: RootState) => state.income;

export const selectAllIncomes = (state: RootState) => state.income.list;

export const selectIncomePagination = createSelector(
  [selectIncomeState],
  (state) => ({
    total: state.total,
    page: state.page,
    limit: state.limit,
  }),
);

export const selectIncomeFilters = createSelector(
  [selectIncomeState],
  (state) => ({
    year: state.year,
    month: state.month,
  }),
);

export const selectIncomeById = (id: string) => (state: RootState) => {
  return state.income.list?.find((income) => income._id === id);
};
