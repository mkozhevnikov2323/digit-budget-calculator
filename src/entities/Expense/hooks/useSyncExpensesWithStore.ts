import { useGetExpensesQuery } from '../api/expenseApi';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect } from 'react';
import { setExpenses } from '../model/expenseSlice';
import { selectExpensesState } from '../model/selectors';

export const useSyncExpensesWithStore = () => {
  const dispatch = useDispatch();
  const { year, month, page, limit } = useSelector(selectExpensesState);

  const {
    data: expensesObj,
    isLoading,
    error,
  } = useGetExpensesQuery({ year, month, page, limit });

  useEffect(() => {
    if (expensesObj) dispatch(setExpenses(expensesObj));
  }, [expensesObj, dispatch]);

  return { isLoading, error };
};
