import { createSlice } from '@reduxjs/toolkit';

const addExpenseModalSlice = createSlice({
  name: 'addExpenseModal',
  initialState: { open: false },
  reducers: {
    open: (state) => ({ ...state, open: true }),
    close: (state) => ({ ...state, open: false }),
  },
});
export const { open, close } = addExpenseModalSlice.actions;
export const { reducer: addExpenseModalReducer } = addExpenseModalSlice;
