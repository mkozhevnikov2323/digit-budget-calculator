import { configureStore } from '@reduxjs/toolkit';
import { authorizationReducer } from 'features/Authorization';
import { userReducer } from 'entities/User';

export const store = configureStore({
  reducer: {
    authorization: authorizationReducer,
    user: userReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
