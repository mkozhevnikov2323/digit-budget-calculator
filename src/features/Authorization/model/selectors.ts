import { RootState } from 'app/providers/store/store';

export const selectIsAuthModalOpen = (state: RootState) =>
  state.authorization.isAuthModalOpen;

export const selectIsAuthenticated = (state: RootState) =>
  state.authorization.isAuthenticated;
