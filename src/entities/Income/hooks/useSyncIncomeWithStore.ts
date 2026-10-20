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

  const { currentData, isLoading, isFetching, isError, refetch } = useGetIncomesQuery({
    year: filters.year,
    month: filters.month,
    page: pagination.page,
    limit: pagination.limit,
  });

  useEffect(() => {
    if (currentData) {
      dispatch(setIncome(currentData));
    }
  }, [currentData, dispatch]);

  return {
    // A refetch with data for these arguments must not unmount active forms.
    isLoading: isLoading || (isFetching && !currentData),
    isError,
    currentData,
    refetch,
  };
};
