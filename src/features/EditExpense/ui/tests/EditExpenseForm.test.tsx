import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSelector } from 'react-redux';
import {
  useDeleteExpenseMutation,
  useUpdateExpenseMutation,
} from 'entities/Expense';
import { EditExpenseForm } from '../EditExpenseForm';

jest.mock('entities/Expense', () => ({
  useUpdateExpenseMutation: jest.fn(),
  useDeleteExpenseMutation: jest.fn(),
  selectExpenseById: jest.fn(() => () => ({
    _id: 'expense-id',
    date: '2026-09-20T12:00:00.000Z',
    amount: 125,
    title: 'Products',
    recipient: 'Store',
    category: 'Food',
    comment: 'Receipt',
  })),
}), { virtual: true });

jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
}));

jest.mock('features/AddExpenseCategory', () => ({
  ExpenseCategoryField: () => null,
}));

jest.mock('features/AddExpenseTitle', () => ({
  ExpenseTitleField: () => null,
}));

jest.mock('features/AddRecipients', () => ({
  RecipientField: () => null,
}));

const mockedUseSelector = useSelector as unknown as jest.Mock;
const mockedUseUpdateExpenseMutation =
  useUpdateExpenseMutation as unknown as jest.Mock;
const mockedUseDeleteExpenseMutation =
  useDeleteExpenseMutation as unknown as jest.Mock;

describe('EditExpenseForm mutations', () => {
  const onClose = jest.fn();
  const updateExpense = jest.fn();
  const deleteExpense = jest.fn();
  const updateUnwrap = jest.fn();
  const deleteUnwrap = jest.fn();
  let consoleLog: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    mockedUseSelector.mockImplementation((selector) => selector({}));
    mockedUseUpdateExpenseMutation.mockReturnValue([updateExpense]);
    mockedUseDeleteExpenseMutation.mockReturnValue([deleteExpense]);
    updateExpense.mockReturnValue({ unwrap: updateUnwrap });
    deleteExpense.mockReturnValue({ unwrap: deleteUnwrap });
  });

  afterEach(() => {
    consoleLog.mockRestore();
  });

  it('closes after a successful update and sends the Mongo _id', async () => {
    updateUnwrap.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <EditExpenseForm
        expenseId="expense-id"
        onClose={onClose}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Сохранить изменения' }),
    );

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(updateExpense).toHaveBeenCalledWith({
      _id: 'expense-id',
      date: '2026-09-20',
      amount: 125,
      title: 'Products',
      recipient: 'Store',
      category: 'Food',
      comment: 'Receipt',
    });
    expect(updateUnwrap).toHaveBeenCalledTimes(1);
  });

  it('stays open after a failed update', async () => {
    updateUnwrap.mockRejectedValue(new Error('Update failed'));
    const user = userEvent.setup();
    render(
      <EditExpenseForm
        expenseId="expense-id"
        onClose={onClose}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Сохранить изменения' }),
    );

    await waitFor(() => expect(updateUnwrap).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes after a successful delete', async () => {
    deleteUnwrap.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <EditExpenseForm
        expenseId="expense-id"
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Удалить расход' }));
    await user.click(screen.getByRole('button', { name: 'Удалить' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(deleteExpense).toHaveBeenCalledWith({ id: 'expense-id' });
    expect(deleteUnwrap).toHaveBeenCalledTimes(1);
  });

  it('keeps the edit UI open after a failed delete', async () => {
    deleteUnwrap.mockRejectedValue(new Error('Delete failed'));
    const user = userEvent.setup();
    render(
      <EditExpenseForm
        expenseId="expense-id"
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Удалить расход' }));
    await user.click(screen.getByRole('button', { name: 'Удалить' }));

    await waitFor(() => expect(deleteUnwrap).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Удалить расход?')).toBeInTheDocument();
  });
});
