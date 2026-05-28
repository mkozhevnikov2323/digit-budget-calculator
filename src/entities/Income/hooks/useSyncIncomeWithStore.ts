import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useGetIncomesQuery } from '../api/incomeApi';
import { setIncome } from '../model/incomeSlice';
import {
  selectIncomeFilters,
  selectIncomePagination,
} from '../model/selectors';

export const useSyncIncomesWithStore = () => {
  const dispatch = useDispatch();
  const filters = useSelector(selectIncomeFilters);
  const pagination = useSelector(selectIncomePagination);

  const { data, isLoading, isFetching, refetch } = useGetIncomesQuery({
    year: filters.year,
    month: filters.month,
    page: pagination.page,
    limit: pagination.limit,
  });

  useEffect(() => {
    if (data) {
      dispatch(setIncome(data));
    }
  }, [data, dispatch]);

  return { isLoading: isLoading || isFetching, refetch };
};
