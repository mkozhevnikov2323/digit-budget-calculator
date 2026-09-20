import { fireEvent, render, screen } from '@testing-library/react';
import { useDispatch, useSelector } from 'react-redux';
import {
  useGetMonthlySummaryQuery,
  useSyncExpensesWithStore,
} from 'entities/Expense';
import { selectExpensesState } from 'entities/Expense/model/selectors';
import {
  open,
  selectIsOpenExpenseModal,
} from 'widgets/Modals/AddExpenseModal';
import ExpensesPage from '../ExpensesPage';

jest.mock('react-redux', () => ({
  useDispatch: jest.fn(),
  useSelector: jest.fn(),
}));

jest.mock(
  'entities/Expense',
  () => ({
    useGetMonthlySummaryQuery: jest.fn(),
    useSyncExpensesWithStore: jest.fn(),
  }),
  { virtual: true },
);

jest.mock(
  'entities/Expense/model/selectors',
  () => ({ selectExpensesState: jest.fn() }),
  { virtual: true },
);

jest.mock(
  'widgets/Expenses/ExpenseTable',
  () => ({ ExpenseTable: () => <div>Expense table</div> }),
  { virtual: true },
);

jest.mock(
  'widgets/Expenses/MonthlySummaryExpenseTable',
  () => ({ MonthlySummaryExpenseTable: () => <div>Monthly summary</div> }),
  { virtual: true },
);

jest.mock(
  'widgets/Modals/AddExpenseModal',
  () => ({
    AddExpenseModal: ({ open: isOpen }: { open: boolean }) => (
      <div data-testid="manual-expense-modal" data-open={String(isOpen)} />
    ),
    close: jest.fn(() => ({ type: 'expenseModal/close' })),
    open: jest.fn(() => ({ type: 'expenseModal/open' })),
    selectIsOpenExpenseModal: jest.fn(),
  }),
  { virtual: true },
);

jest.mock(
  'features/AddExpenseFromPhoto',
  () => ({ AddExpenseFromPhoto: () => <div>Photo expense flow</div> }),
  { virtual: true },
);

jest.mock(
  'shared/ui/Modal',
  () => ({
    Modal: ({ children }: { children: React.ReactNode }) => (
      <div role="dialog">{children}</div>
    ),
  }),
  { virtual: true },
);

const mockUseDispatch = useDispatch as unknown as jest.Mock;
const mockUseSelector = useSelector as unknown as jest.Mock;
const mockUseGetMonthlySummaryQuery =
  useGetMonthlySummaryQuery as jest.Mock;
const mockUseSyncExpensesWithStore = useSyncExpensesWithStore as jest.Mock;

describe('ExpensesPage expense creation actions', () => {
  it('keeps the manual Redux flow separate from the local photo flow', () => {
    const dispatch = jest.fn();
    mockUseDispatch.mockReturnValue(dispatch);
    mockUseSyncExpensesWithStore.mockReturnValue({ isLoading: false });
    mockUseGetMonthlySummaryQuery.mockReturnValue({
      data: { expenses: [] },
    });
    mockUseSelector.mockImplementation((selector) => {
      if (selector === selectExpensesState) {
        return { year: 2026, month: 9 };
      }
      if (selector === selectIsOpenExpenseModal) return false;
      return undefined;
    });

    render(<ExpensesPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Добавить расход' }));

    expect(open).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'expenseModal/open' });
    expect(screen.getByTestId('manual-expense-modal')).toHaveAttribute(
      'data-open',
      'false',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Добавить по фото' }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Photo expense flow');
    expect(open).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});
