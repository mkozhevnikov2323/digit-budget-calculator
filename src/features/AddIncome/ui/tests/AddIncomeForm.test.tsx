import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const mockValidateAmount = jest.fn();

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
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
        rules={{ required: true, validate: () => mockValidateAmount() }}
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
    jest.resetAllMocks();
    mockValidateAmount.mockReturnValue(true);
    mockedUseAddIncomeMutation.mockReturnValue([addIncome]);
    mockedUseAddUserSourceMutation.mockReturnValue([addUserSource]);
    mockedUseGetDefaultSourcesQuery.mockReturnValue({ data: [] });
    mockedUseGetUserSourcesQuery.mockReturnValue({ data: [] });
    addIncome.mockReturnValue({ unwrap: addIncomeUnwrap });
    addUserSource.mockReturnValue({ unwrap: addUserSourceUnwrap });
    addIncomeUnwrap.mockResolvedValue(undefined);
    addUserSourceUnwrap.mockResolvedValue(undefined);
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
    expect(await screen.findByText(/Не удалось обновить подсказку источника/)).toBeVisible();
    expect(screen.getByText('Доход сохранён.')).toBeVisible();
    expect(screen.queryByText(/Доход мог уже сохраниться/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Добавить доход' })).toBeEnabled();
  });

  it('blocks rapid clicks throughout asynchronous validation and persistence', async () => {
    const validation = deferred<boolean>();
    const pending = deferred<void>();
    const onStateChange = jest.fn();
    mockValidateAmount.mockReturnValueOnce(validation.promise);
    addIncomeUnwrap.mockReturnValueOnce(pending.promise);
    render(<AddIncomeForm onSubmissionStateChange={onStateChange} />);
    fillForm();
    const button = screen.getByRole('button', { name: 'Добавить доход' });
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.submit(button.closest('form')!);
      expect(onStateChange).toHaveBeenLastCalledWith({ isBusy: true, hasUncertainResult: false });
    });
    expect(addIncome).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
    expect(screen.getByLabelText('date')).toBeDisabled();
    expect(screen.getByLabelText('amount')).toBeDisabled();
    expect(screen.getByLabelText('source')).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Комментарий' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Сохранение дохода');

    await act(async () => validation.resolve(true));
    await waitFor(() => expect(addIncome).toHaveBeenCalledTimes(1));
    fireEvent.submit(button.closest('form')!);
    expect(addIncome).toHaveBeenCalledTimes(1);
    expect(addUserSource).not.toHaveBeenCalled();
    await act(async () => pending.resolve());
    await waitFor(() => expect(button).toBeEnabled());
    expect(onStateChange).toHaveBeenLastCalledWith({ isBusy: false, hasUncertainResult: false });
    expect(addIncome).toHaveBeenCalledTimes(1);
  });

  it('blocks repeated Enter submissions while the income POST is pending', async () => {
    const pending = deferred<void>();
    addIncomeUnwrap.mockReturnValueOnce(pending.promise);
    const user = userEvent.setup();
    render(<AddIncomeForm />);
    fillForm();
    await user.click(screen.getByRole('textbox', { name: 'Комментарий' }));
    await user.keyboard('{Enter}{Enter}{Enter}');
    await waitFor(() => expect(addIncome).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Добавить доход' })).toBeDisabled();
    await act(async () => pending.resolve());
    expect(await screen.findByText('Доход сохранён.')).toBeVisible();
    expect(addIncome).toHaveBeenCalledTimes(1);
  });

  it('releases the guard after invalid validation so corrected input can be submitted', async () => {
    mockValidateAmount.mockReturnValue(false);
    render(<AddIncomeForm />);
    fillForm();
    const button = screen.getByRole('button', { name: 'Добавить доход' });
    fireEvent.submit(button.closest('form')!);
    await waitFor(() => expect(button).toBeEnabled());
    expect(addIncome).not.toHaveBeenCalled();
    mockValidateAmount.mockReturnValue(true);
    fireEvent.change(screen.getByLabelText('amount'), { target: { value: '200' } });
    await userEvent.click(button);
    expect(await screen.findByText('Доход сохранён.')).toBeVisible();
    expect(addIncome).toHaveBeenCalledTimes(1);
  });

  it('preserves uncertain input and blocks retries until acknowledgement without sending on acknowledgement', async () => {
    const pending = deferred<void>();
    addIncomeUnwrap.mockReturnValueOnce(pending.promise);
    render(<AddIncomeForm />);
    fillForm();
    const button = screen.getByRole('button', { name: 'Добавить доход' });
    fireEvent.submit(button.closest('form')!);
    await waitFor(() => expect(addIncome).toHaveBeenCalledTimes(1));
    await act(async () => pending.reject(new Error('Response lost')));
    expect(await screen.findByText(/Доход мог уже сохраниться/)).toHaveTextContent('Проверьте историю доходов');
    expect(button).toBeDisabled();
    expect(screen.getByLabelText('date')).toHaveValue('2026-09-20');
    expect(screen.getByLabelText('amount')).toHaveValue('123.45');
    expect(screen.getByLabelText('source')).toHaveValue('New source');
    expect(screen.getByRole('textbox', { name: 'Комментарий' })).toHaveValue('Income comment');
    fireEvent.submit(button.closest('form')!);
    fireEvent.submit(button.closest('form')!);
    expect(addIncome).toHaveBeenCalledTimes(1);
    expect(addUserSource).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'История проверена, продолжить ввод' }));
    expect(button).toBeEnabled();
    expect(addIncome).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('amount')).toHaveValue('123.45');
    await userEvent.click(button);
    expect(await screen.findByText('Доход сохранён.')).toBeVisible();
    expect(addIncome).toHaveBeenCalledTimes(2);
  });

  it('keeps the guard until auxiliary work settles and permits a later deliberate income', async () => {
    const sourcePending = deferred<void>();
    addUserSourceUnwrap.mockReturnValueOnce(sourcePending.promise);
    render(<AddIncomeForm />);
    fillForm();
    const button = screen.getByRole('button', { name: 'Добавить доход' });
    await userEvent.click(button);
    expect(await screen.findByText('Доход сохранён.')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Обновление источника дохода');
    expect(button).toBeDisabled();
    expect(screen.getByLabelText('date')).toHaveValue('2026-09-20');
    expect(screen.getByLabelText('amount')).toHaveValue('');
    fireEvent.submit(button.closest('form')!);
    expect(addIncome).toHaveBeenCalledTimes(1);
    await act(async () => sourcePending.resolve());
    await waitFor(() => expect(button).toBeEnabled());
    fillForm();
    await userEvent.click(button);
    await waitFor(() => expect(button).toBeEnabled());
    expect(addIncome).toHaveBeenCalledTimes(2);
  });
});
