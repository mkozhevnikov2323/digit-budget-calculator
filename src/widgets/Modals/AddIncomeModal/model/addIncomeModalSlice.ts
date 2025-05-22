import { createSlice } from '@reduxjs/toolkit';

const addIncomeModalSlice = createSlice({
  name: 'addIncomeModal',
  initialState: { open: false },
  reducers: {
    open: (state) => ({ ...state, open: true }),
    close: (state) => ({ ...state, open: false }),
  },
});
export const { open, close } = addIncomeModalSlice.actions;
export const { reducer: addIncomeModalReducer } = addIncomeModalSlice;
