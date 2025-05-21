import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ExpenseSchema, ExpenseState } from './types';

const initialState: ExpenseState = {
  list: null,
};

const expenseSlice = createSlice({
  name: 'expenses',
  initialState,
  reducers: {
    setExpenses: (state, action: PayloadAction<ExpenseSchema[]>) => {
      state.list = action.payload;
    },
    resetExpenses: (state) => {
      state.list = null;
    },
  },
});

export const { setExpenses, resetExpenses } = expenseSlice.actions;
export const { reducer } = expenseSlice;
