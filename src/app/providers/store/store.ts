import { configureStore } from '@reduxjs/toolkit';
import { authorizationReducer } from 'features/Authorization';
import { userReducer } from 'entities/User';
import { baseApi } from 'shared/api/baseApi';

export const store = configureStore({
  reducer: {
    authorization: authorizationReducer,
    user: userReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
