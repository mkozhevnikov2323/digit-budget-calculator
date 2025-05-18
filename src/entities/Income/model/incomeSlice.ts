import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { IncomeSchema, IncomeState } from './types';

const initialState: IncomeState = {
  list: null,
};

const incomeSlice = createSlice({
  name: 'income',
  initialState,
  reducers: {
    setIncome: (state, action: PayloadAction<IncomeSchema[]>) => {
      state.list = action.payload;
    },
    resetIncome: (state) => {
      state.list = null;
    },
  },
});

export const { setIncome, resetIncome } = incomeSlice.actions;
export const { reducer } = incomeSlice;
