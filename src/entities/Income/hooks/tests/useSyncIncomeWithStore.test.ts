import { renderHook } from '@testing-library/react';
import { useDispatch, useSelector } from 'react-redux';
import { useGetIncomesQuery } from '../../api/incomeApi';
import { useSyncIncomesWithStore } from '../useSyncIncomeWithStore';

jest.mock('react-redux', () => ({
  useDispatch: jest.fn(),
  useSelector: jest.fn(),
}));

jest.mock('../../api/incomeApi', () => ({
  useGetIncomesQuery: jest.fn(),
}));

const mockUseDispatch = useDispatch as unknown as jest.Mock;
const mockUseSelector = useSelector as unknown as jest.Mock;
const mockUseGetIncomesQuery = useGetIncomesQuery as jest.Mock;

describe('useSyncIncomesWithStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDispatch.mockReturnValue(jest.fn());
    mockUseSelector
      .mockReturnValueOnce({ year: 2026, month: 9 })
      .mockReturnValueOnce({ page: 1, limit: 20 });
  });

  it('does not report a background refetch as initial loading', () => {
    const refetch = jest.fn();
    mockUseGetIncomesQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: true,
      refetch,
    });

    const { result } = renderHook(() => useSyncIncomesWithStore());

    expect(result.current).toEqual({
      isLoading: false,
      isFetching: true,
      refetch,
    });
    expect(mockUseGetIncomesQuery).toHaveBeenCalledWith({
      year: 2026,
      month: 9,
      page: 1,
      limit: 20,
    });
  });
});
