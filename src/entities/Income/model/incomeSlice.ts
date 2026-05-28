import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { IncomeResponse, IncomeState } from './types';

const initialState: IncomeState = {
  list: null,
  total: 0,
  page: 1,
  limit: 20,
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
};

const incomeSlice = createSlice({
  name: 'income',
  initialState,
  reducers: {
    setIncome: (state, action: PayloadAction<IncomeResponse>) => {
      state.list = action.payload.incomes;
      state.total = action.payload.total;
      state.page = action.payload.page;
      state.limit = action.payload.limit;
    },
    setPage: (state, action: PayloadAction<number>) => {
      state.page = action.payload;
    },
    setYear: (state, action: PayloadAction<number>) => {
      state.year = action.payload;
      state.page = 1;
    },
    setMonth: (state, action: PayloadAction<number>) => {
      state.month = action.payload;
      state.page = 1;
    },
    resetIncomeFilters: (state) => {
      state.year = new Date().getFullYear();
      state.month = new Date().getMonth() + 1;
      state.page = 1;
    },
    resetIncome: (state) => {
      state.list = null;
      state.total = 0;
      state.page = 1;
    },
  },
});

export const {
  setIncome,
  setPage,
  setYear,
  setMonth,
  resetIncomeFilters,
  resetIncome,
} = incomeSlice.actions;

export const { reducer } = incomeSlice;
