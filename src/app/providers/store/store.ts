import { configureStore } from '@reduxjs/toolkit';
import { authorizationReducer } from 'features/Authorization';
import { userReducer } from 'entities/User';
import { baseApi } from 'shared/api/baseApi';
import { incomeReducer } from 'entities/Income';
import { expenseReducer } from 'entities/Expense';
import { addIncomeModalReducer } from 'widgets/Modals/AddIncomeModal';

export const store = configureStore({
  reducer: {
    authorization: authorizationReducer,
    user: userReducer,
    income: incomeReducer,
    expenses: expenseReducer,
    incomeModal: addIncomeModalReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
