import { RootState } from 'app/providers/store/store';

export const selectUser = (state: RootState) => state.user.user;
