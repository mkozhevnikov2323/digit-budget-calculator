import { useGetIncomesQuery } from '../api/incomeApi';
import { setIncome } from '../model/incomeSlice';
import { useDispatch } from 'react-redux';
import { useEffect } from 'react';

export const useSyncIncomeWithStore = () => {
  const { data: incomes, isLoading, error } = useGetIncomesQuery();
  const dispatch = useDispatch();

  useEffect(() => {
    if (incomes) dispatch(setIncome(incomes));
  }, [incomes, dispatch]);

  return { isLoading, error };
};
