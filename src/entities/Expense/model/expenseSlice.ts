import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ExpenseResponse, ExpenseState } from './types';

const currentDate = new Date();

const initialState: ExpenseState = {
  list: null,
  total: 0,
  page: 1,
  limit: 20,
  year: currentDate.getFullYear(),
  month: currentDate.getMonth() + 1,
};

const expenseSlice = createSlice({
  name: 'expenses',
  initialState,
  reducers: {
    setExpenses: (state, action: PayloadAction<ExpenseResponse>) => {
      state.list = action.payload.expenses;
      state.total = action.payload.total;
      state.page = action.payload.page;
      state.limit = action.payload.limit;
    },
    setPage: (state, action: PayloadAction<number>) => {
      state.page = action.payload;
    },
    setYear: (state, action: PayloadAction<number>) => {
      state.year = action.payload;
    },
    setMonth: (state, action: PayloadAction<number>) => {
      state.month = action.payload;
    },
    resetExpenses: (state) => {
      state.list = null;
      state.total = 0;
      state.page = 1;
      state.limit = 20;
    },
  },
});

export const { setExpenses, setPage, setYear, setMonth, resetExpenses } =
  expenseSlice.actions;
export const { reducer } = expenseSlice;
