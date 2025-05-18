import { configureStore } from '@reduxjs/toolkit';
import { authorizationReducer } from 'features/Authorization';
import { userReducer } from 'entities/User';
import { baseApi } from 'shared/api/baseApi';
import { incomeApi, incomeReducer } from 'entities/Income';

export const store = configureStore({
  reducer: {
    authorization: authorizationReducer,
    user: userReducer,
    income: incomeReducer,
    [baseApi.reducerPath]: baseApi.reducer,
    [incomeApi.reducerPath]: incomeApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware, incomeApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
