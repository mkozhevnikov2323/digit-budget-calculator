import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSelector } from 'react-redux';
import {
  useDeleteIncomeMutation,
  useUpdateIncomeMutation,
} from 'entities/Income';
import { EditIncomeForm } from '../EditincomeForm';

jest.mock('entities/Income', () => ({
  useUpdateIncomeMutation: jest.fn(),
  useDeleteIncomeMutation: jest.fn(),
  selectIncomeById: jest.fn(() => () => ({
    _id: 'income-id',
    date: '2026-09-20T12:00:00.000Z',
    amount: 500,
    source: 'Salary',
    comment: 'September',
  })),
}), { virtual: true });

jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
}));

jest.mock('features/AddIncomeSource', () => ({
  IncomeSourceField: () => null,
}));

const mockedUseSelector = useSelector as unknown as jest.Mock;
const mockedUseUpdateIncomeMutation =
  useUpdateIncomeMutation as unknown as jest.Mock;
const mockedUseDeleteIncomeMutation =
  useDeleteIncomeMutation as unknown as jest.Mock;

describe('EditIncomeForm mutations', () => {
  const onClose = jest.fn();
  const updateIncome = jest.fn();
  const deleteIncome = jest.fn();
  const updateUnwrap = jest.fn();
  const deleteUnwrap = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseSelector.mockImplementation((selector) => selector({}));
    mockedUseUpdateIncomeMutation.mockReturnValue([updateIncome]);
    mockedUseDeleteIncomeMutation.mockReturnValue([deleteIncome]);
    updateIncome.mockReturnValue({ unwrap: updateUnwrap });
    deleteIncome.mockReturnValue({ unwrap: deleteUnwrap });
  });

  it('closes after a successful update', async () => {
    updateUnwrap.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <EditIncomeForm
        incomeId="income-id"
        onClose={onClose}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Сохранить изменения' }),
    );

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(updateIncome).toHaveBeenCalledWith({
      _id: 'income-id',
      date: '2026-09-20',
      amount: 500,
      source: 'Salary',
      comment: 'September',
    });
    expect(updateUnwrap).toHaveBeenCalledTimes(1);
  });

  it('stays open after a failed update', async () => {
    updateUnwrap.mockRejectedValue(new Error('Update failed'));
    const user = userEvent.setup();
    render(
      <EditIncomeForm
        incomeId="income-id"
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
      <EditIncomeForm
        incomeId="income-id"
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Удалить доход' }));
    await user.click(screen.getByRole('button', { name: 'Удалить' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(deleteIncome).toHaveBeenCalledWith({ id: 'income-id' });
    expect(deleteUnwrap).toHaveBeenCalledTimes(1);
  });

  it('keeps the edit UI open after a failed delete', async () => {
    deleteUnwrap.mockRejectedValue(new Error('Delete failed'));
    const user = userEvent.setup();
    render(
      <EditIncomeForm
        incomeId="income-id"
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Удалить доход' }));
    await user.click(screen.getByRole('button', { name: 'Удалить' }));

    await waitFor(() => expect(deleteUnwrap).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Удалить доход?')).toBeInTheDocument();
  });
});
