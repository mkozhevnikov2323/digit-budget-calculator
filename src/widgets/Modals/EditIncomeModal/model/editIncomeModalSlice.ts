import { createSlice } from '@reduxjs/toolkit';

const editIncomeModalSlice = createSlice({
  name: 'editIncomeModal',
  initialState: { open: false },
  reducers: {
    open: (state) => ({ ...state, open: true }),
    close: (state) => ({ ...state, open: false }),
  },
});
export const { open, close } = editIncomeModalSlice.actions;
export const { reducer: editIncomeModalReducer } = editIncomeModalSlice;
