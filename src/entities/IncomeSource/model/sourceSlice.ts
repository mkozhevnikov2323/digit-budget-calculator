import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SourceSchema } from './types';

interface IncomeSourceState {
  defaultSources: SourceSchema[];
  userSources: SourceSchema[];
  loading: boolean;
  error: string | null;
}

const initialState: IncomeSourceState = {
  defaultSources: [],
  userSources: [],
  loading: false,
  error: null,
};

const incomeSourceSlice = createSlice({
  name: 'incomeSource',
  initialState,
  reducers: {
    setDefaultSources(state, action: PayloadAction<SourceSchema[]>) {
      state.defaultSources = action.payload;
    },
    setUserSources(state, action: PayloadAction<SourceSchema[]>) {
      state.userSources = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const { setDefaultSources, setUserSources, setLoading, setError } =
  incomeSourceSlice.actions;

export const { reducer: incomeSourceReducer } = incomeSourceSlice;
