import { RootState } from 'app/providers/store/store';

export const selectDefaultSources = (state: RootState) =>
  state.incomeSource.defaultSources;

export const selectUserSources = (state: RootState) =>
  state.incomeSource.userSources;

export const selectIncomeSourcesLoading = (state: RootState) =>
  state.incomeSource.loading;

export const selectIncomeSourcesError = (state: RootState) =>
  state.incomeSource.error;
