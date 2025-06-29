import { createSlice } from '@reduxjs/toolkit';

const editExpenseModalSlice = createSlice({
  name: 'editExpenseModal',
  initialState: { open: false },
  reducers: {
    open: (state) => ({ ...state, open: true }),
    close: (state) => ({ ...state, open: false }),
  },
});
export const { open, close } = editExpenseModalSlice.actions;
export const { reducer: editExpenseModalReducer } = editExpenseModalSlice;
