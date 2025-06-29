import { useGetExpensesQuery } from '../api/expenseApi';
import { useDispatch } from 'react-redux';
import { useEffect } from 'react';
import { setExpenses } from '../model/expenseSlice';

export const useSyncExpensesWithStore = () => {
  const { data: expenses, isLoading, error } = useGetExpensesQuery();
  const dispatch = useDispatch();

  useEffect(() => {
    if (expenses) dispatch(setExpenses(expenses));
  }, [expenses, dispatch]);

  return { isLoading, error };
};
