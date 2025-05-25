import { configureStore } from '@reduxjs/toolkit';
import rootReducer from './rootReducer';
import { baseApi } from 'shared/api/baseApi';

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
