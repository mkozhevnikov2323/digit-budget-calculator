import { AnyAction, combineReducers } from '@reduxjs/toolkit';
import { authorizationReducer } from 'features/Authorization';
import { userReducer } from 'entities/User';
import { baseApi } from 'shared/api/baseApi';
import { incomeReducer } from 'entities/Income';
import { expenseReducer } from 'entities/Expense';
import { addIncomeModalReducer } from 'widgets/Modals/AddIncomeModal';
import { incomeSourceReducer } from 'entities/IncomeSource';
import { addExpenseModalReducer } from 'widgets/Modals/AddExpenseModal';

const appReducer = combineReducers({
  authorization: authorizationReducer,
  user: userReducer,
  income: incomeReducer,
  expenses: expenseReducer,
  incomeModal: addIncomeModalReducer,
  expenseModal: addExpenseModalReducer,
  incomeSource: incomeSourceReducer,
  [baseApi.reducerPath]: baseApi.reducer,
});

type RootState = ReturnType<typeof appReducer>;

const rootReducer = (
  state: RootState | undefined,
  action: AnyAction,
): RootState => {
  if (action.type === 'LOGOUT') {
    state = undefined;
  }
  return appReducer(state, action);
};

export default rootReducer;
