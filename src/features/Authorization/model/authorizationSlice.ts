import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  isAuthModalOpen: boolean;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  isAuthModalOpen: false,
  isAuthenticated: false,
};

const authorizationSlice = createSlice({
  name: 'authorization',
  initialState,
  reducers: {
    openAuthModal: (state) => {
      state.isAuthModalOpen = true;
    },
    closeAuthModal: (state) => {
      state.isAuthModalOpen = false;
    },
    setAuthenticated: (state, action: PayloadAction<boolean>) => {
      state.isAuthenticated = action.payload;
    },
  },
});

export const { openAuthModal, closeAuthModal, setAuthenticated } =
  authorizationSlice.actions;

export const { reducer } = authorizationSlice;
