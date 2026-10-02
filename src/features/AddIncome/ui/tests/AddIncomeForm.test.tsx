import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Control, FieldValues } from 'react-hook-form';
import { useAddIncomeMutation } from 'entities/Income';
import {
  useAddUserSourceMutation,
  useGetDefaultSourcesQuery,
  useGetUserSourcesQuery,
} from 'entities/IncomeSource';
import { AddIncomeForm } from '../AddIncomeForm';

type MockFieldProps = {
  name: string;
  control: Control<FieldValues>;
};

jest.mock('entities/Income', () => ({
  useAddIncomeMutation: jest.fn(),
}), { virtual: true });

jest.mock('entities/IncomeSource', () => ({
  useAddUserSourceMutation: jest.fn(),
  useGetDefaultSourcesQuery: jest.fn(),
  useGetUserSourcesQuery: jest.fn(),
}), { virtual: true });

jest.mock('shared/ui/DateField', () => {
  const { Controller } = jest.requireActual('react-hook-form') as typeof import('react-hook-form');
  return {
    DateField: ({ name, control }: MockFieldProps) => (
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <input
            aria-label="date"
            value={String(field.value ?? '')}
            onChange={field.onChange}
          />
        )}
      />
    ),
  };
}, { virtual: true });

jest.mock('shared/ui/AmountField', () => {
  const { Controller } = jest.requireActual('react-hook-form') as typeof import('react-hook-form');
  return {
    AmountField: ({ name, control }: MockFieldProps) => (
      <Controller
        name={name}
        control={control}
        rules={{ required: true }}
        render={({ field }) => (
          <input
            aria-label="amount"
            value={field.value === 0 ? '' : String(field.value ?? '')}
            onChange={field.onChange}
          />
        )}
      />
    ),
  };
}, { virtual: true });

jest.mock('features/AddIncomeSource', () => {
  const { Controller } = jest.requireActual('react-hook-form') as typeof import('react-hook-form');
  return {
    IncomeSourceField: ({ name, control }: MockFieldProps) => (
      <Controller
        name={name}
        control={control}
        rules={{ required: true }}
        render={({ field }) => (
          <input
            aria-label="source"
            value={String(field.value ?? '')}
            onChange={field.onChange}
          />
        )}
      />
    ),
  };
}, { virtual: true });

const mockedUseAddIncomeMutation =
  useAddIncomeMutation as unknown as jest.Mock;
const mockedUseAddUserSourceMutation =
  useAddUserSourceMutation as unknown as jest.Mock;
const mockedUseGetDefaultSourcesQuery =
  useGetDefaultSourcesQuery as unknown as jest.Mock;
const mockedUseGetUserSourcesQuery =
  useGetUserSourcesQuery as unknown as jest.Mock;

describe('AddIncomeForm create flow', () => {
  const addIncome = jest.fn();
  const addIncomeUnwrap = jest.fn();
  const addUserSource = jest.fn();
  const addUserSourceUnwrap = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAddIncomeMutation.mockReturnValue([addIncome]);
    mockedUseAddUserSourceMutation.mockReturnValue([addUserSource]);
    mockedUseGetDefaultSourcesQuery.mockReturnValue({ data: [] });
    mockedUseGetUserSourcesQuery.mockReturnValue({ data: [] });
    addIncome.mockReturnValue({ unwrap: addIncomeUnwrap });
    addUserSource.mockReturnValue({ unwrap: addUserSourceUnwrap });
  });

  const fillForm = () => {
    fireEvent.change(screen.getByLabelText('date'), {
      target: { value: '2026-09-20' },
    });
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '123.45' },
    });
    fireEvent.change(screen.getByLabelText('source'), {
      target: { value: 'New source' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Комментарий' }), {
      target: { value: 'Income comment' },
    });
  };

  it('resets after successful persistence and preserves the selected date', async () => {
    addIncomeUnwrap.mockResolvedValue(undefined);
    addUserSourceUnwrap.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AddIncomeForm />);
    fillForm();

    await user.click(screen.getByRole('button', { name: 'Добавить доход' }));

    await waitFor(() => expect(addUserSourceUnwrap).toHaveBeenCalledTimes(1));
    expect(addIncomeUnwrap).toHaveBeenCalledTimes(1);
    expect(addIncome.mock.invocationCallOrder[0]).toBeLessThan(
      addUserSource.mock.invocationCallOrder[0],
    );
    expect(screen.getByLabelText('date')).toHaveValue('2026-09-20');
    expect(screen.getByLabelText('amount')).toHaveValue('');
    expect(screen.getByLabelText('source')).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Комментарий' })).toHaveValue(
      '',
    );
  });

  it('preserves all values and skips auxiliary writes after primary failure', async () => {
    addIncomeUnwrap.mockRejectedValue(new Error('Income failed'));
    const user = userEvent.setup();
    render(<AddIncomeForm />);
    fillForm();

    await user.click(screen.getByRole('button', { name: 'Добавить доход' }));

    await waitFor(() => expect(addIncomeUnwrap).toHaveBeenCalledTimes(1));
    expect(addUserSource).not.toHaveBeenCalled();
    expect(screen.getByLabelText('date')).toHaveValue('2026-09-20');
    expect(screen.getByLabelText('amount')).toHaveValue('123.45');
    expect(screen.getByLabelText('source')).toHaveValue('New source');
    expect(screen.getByRole('textbox', { name: 'Комментарий' })).toHaveValue(
      'Income comment',
    );
  });

  it('does not persist while the user only renders and edits the form', () => {
    render(<AddIncomeForm />);
    fillForm();

    expect(addIncome).not.toHaveBeenCalled();
    expect(addUserSource).not.toHaveBeenCalled();
  });

  it('keeps the successful reset when auxiliary synchronization fails', async () => {
    addIncomeUnwrap.mockResolvedValue(undefined);
    addUserSourceUnwrap.mockRejectedValue(new Error('Source failed'));
    const user = userEvent.setup();
    render(<AddIncomeForm />);
    fillForm();

    await user.click(screen.getByRole('button', { name: 'Добавить доход' }));

    await waitFor(() => expect(addUserSourceUnwrap).toHaveBeenCalledTimes(1));
    expect(addIncome).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('date')).toHaveValue('2026-09-20');
    expect(screen.getByLabelText('amount')).toHaveValue('');
    expect(screen.getByLabelText('source')).toHaveValue('');
  });
});
