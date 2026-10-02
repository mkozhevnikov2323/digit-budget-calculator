import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Control, FieldValues } from 'react-hook-form';
import { useAddExpenseMutation } from 'entities/Expense';
import {
  useAddUserCategoryMutation,
  useGetDefaultCategoriesQuery,
  useGetUserCategoriesQuery,
} from 'entities/ExpenseCategory';
import {
  useAddExpenseTitleMutation,
  useGetExpenseTitlesQuery,
} from 'entities/ExpenseTitle';
import {
  useAddRecipientMutation,
  useGetRecipientsQuery,
} from 'entities/Recipient';
import { AddExpenseForm } from '../AddExpenseForm';

type MockFieldProps = {
  name: string;
  control: Control<FieldValues>;
};

const createControlledFieldModule = (exportName: string, label: string) => {
  const { Controller } = jest.requireActual('react-hook-form') as typeof import('react-hook-form');
  return {
    [exportName]: ({ name, control }: MockFieldProps) => (
      <Controller
        name={name}
        control={control}
        rules={{ required: true }}
        render={({ field }) => (
          <input
            aria-label={label}
            value={field.value === 0 ? '' : String(field.value ?? '')}
            onChange={field.onChange}
          />
        )}
      />
    ),
  };
};

jest.mock('entities/Expense', () => ({
  useAddExpenseMutation: jest.fn(),
}), { virtual: true });

jest.mock('entities/ExpenseCategory', () => ({
  useAddUserCategoryMutation: jest.fn(),
  useGetDefaultCategoriesQuery: jest.fn(),
  useGetUserCategoriesQuery: jest.fn(),
}), { virtual: true });

jest.mock('entities/ExpenseTitle', () => ({
  useAddExpenseTitleMutation: jest.fn(),
  useGetExpenseTitlesQuery: jest.fn(),
}), { virtual: true });

jest.mock('entities/Recipient', () => ({
  useAddRecipientMutation: jest.fn(),
  useGetRecipientsQuery: jest.fn(),
}), { virtual: true });

jest.mock(
  'shared/ui/DateField',
  () => createControlledFieldModule('DateField', 'date'),
  { virtual: true },
);
jest.mock(
  'shared/ui/AmountField',
  () => createControlledFieldModule('AmountField', 'amount'),
  { virtual: true },
);
jest.mock(
  'features/AddExpenseTitle',
  () => createControlledFieldModule('ExpenseTitleField', 'title'),
  { virtual: true },
);
jest.mock(
  'features/AddRecipients',
  () => createControlledFieldModule('RecipientField', 'recipient'),
  { virtual: true },
);
jest.mock(
  'features/AddExpenseCategory',
  () => createControlledFieldModule('ExpenseCategoryField', 'category'),
  { virtual: true },
);

const mockedUseAddExpenseMutation =
  useAddExpenseMutation as unknown as jest.Mock;
const mockedUseAddUserCategoryMutation =
  useAddUserCategoryMutation as unknown as jest.Mock;
const mockedUseGetDefaultCategoriesQuery =
  useGetDefaultCategoriesQuery as unknown as jest.Mock;
const mockedUseGetUserCategoriesQuery =
  useGetUserCategoriesQuery as unknown as jest.Mock;
const mockedUseAddExpenseTitleMutation =
  useAddExpenseTitleMutation as unknown as jest.Mock;
const mockedUseGetExpenseTitlesQuery =
  useGetExpenseTitlesQuery as unknown as jest.Mock;
const mockedUseAddRecipientMutation =
  useAddRecipientMutation as unknown as jest.Mock;
const mockedUseGetRecipientsQuery =
  useGetRecipientsQuery as unknown as jest.Mock;

describe('AddExpenseForm create flow', () => {
  const addExpense = jest.fn();
  const addExpenseUnwrap = jest.fn();
  const addUserCategory = jest.fn();
  const addUserCategoryUnwrap = jest.fn();
  const addExpenseTitle = jest.fn();
  const addExpenseTitleUnwrap = jest.fn();
  const addRecipient = jest.fn();
  const addRecipientUnwrap = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAddExpenseMutation.mockReturnValue([
      addExpense,
      { error: undefined },
    ]);
    mockedUseAddUserCategoryMutation.mockReturnValue([addUserCategory]);
    mockedUseAddExpenseTitleMutation.mockReturnValue([addExpenseTitle]);
    mockedUseAddRecipientMutation.mockReturnValue([addRecipient]);
    mockedUseGetDefaultCategoriesQuery.mockReturnValue({ data: [] });
    mockedUseGetUserCategoriesQuery.mockReturnValue({ data: [] });
    mockedUseGetExpenseTitlesQuery.mockReturnValue({ data: [] });
    mockedUseGetRecipientsQuery.mockReturnValue({ data: [] });
    addExpense.mockReturnValue({ unwrap: addExpenseUnwrap });
    addUserCategory.mockReturnValue({ unwrap: addUserCategoryUnwrap });
    addExpenseTitle.mockReturnValue({ unwrap: addExpenseTitleUnwrap });
    addRecipient.mockReturnValue({ unwrap: addRecipientUnwrap });
  });

  const fillForm = () => {
    fireEvent.change(screen.getByLabelText('date'), {
      target: { value: '2026-09-20' },
    });
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '123.45' },
    });
    fireEvent.change(screen.getByLabelText('title'), {
      target: { value: 'New title' },
    });
    fireEvent.change(screen.getByLabelText('recipient'), {
      target: { value: 'New recipient' },
    });
    fireEvent.change(screen.getByLabelText('category'), {
      target: { value: 'New category' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Комментарий' }), {
      target: { value: 'Expense comment' },
    });
  };

  it('shows success, resets fields, and preserves date after persistence', async () => {
    addExpenseUnwrap.mockResolvedValue(undefined);
    addUserCategoryUnwrap.mockResolvedValue(undefined);
    addExpenseTitleUnwrap.mockResolvedValue(undefined);
    addRecipientUnwrap.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AddExpenseForm />);
    fillForm();

    await user.click(screen.getByRole('button', { name: 'Добавить расход' }));

    expect(await screen.findByText('Расход добавлен!')).toBeInTheDocument();
    await waitFor(() => expect(addRecipientUnwrap).toHaveBeenCalledTimes(1));
    expect(addExpenseUnwrap).toHaveBeenCalledTimes(1);
    expect(addExpense.mock.invocationCallOrder[0]).toBeLessThan(
      addUserCategory.mock.invocationCallOrder[0],
    );
    expect(screen.getByLabelText('date')).toHaveValue('2026-09-20');
    expect(screen.getByLabelText('amount')).toHaveValue('');
    expect(screen.getByLabelText('title')).toHaveValue('');
    expect(screen.getByLabelText('recipient')).toHaveValue('');
    expect(screen.getByLabelText('category')).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Комментарий' })).toHaveValue(
      '',
    );
  });

  it('keeps values, shows no success, and skips auxiliary writes on failure', async () => {
    addExpenseUnwrap.mockRejectedValue(new Error('Expense failed'));
    const user = userEvent.setup();
    render(<AddExpenseForm />);
    fillForm();

    await user.click(screen.getByRole('button', { name: 'Добавить расход' }));

    await waitFor(() => expect(addExpenseUnwrap).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Расход добавлен!')).not.toBeInTheDocument();
    expect(addUserCategory).not.toHaveBeenCalled();
    expect(addExpenseTitle).not.toHaveBeenCalled();
    expect(addRecipient).not.toHaveBeenCalled();
    expect(screen.getByLabelText('date')).toHaveValue('2026-09-20');
    expect(screen.getByLabelText('amount')).toHaveValue('123.45');
    expect(screen.getByLabelText('title')).toHaveValue('New title');
    expect(screen.getByLabelText('recipient')).toHaveValue('New recipient');
    expect(screen.getByLabelText('category')).toHaveValue('New category');
    expect(screen.getByRole('textbox', { name: 'Комментарий' })).toHaveValue(
      'Expense comment',
    );
  });

  it('still reports success and stays reset when auxiliary sync fails', async () => {
    addExpenseUnwrap.mockResolvedValue(undefined);
    addUserCategoryUnwrap.mockRejectedValue(new Error('Category failed'));
    addExpenseTitleUnwrap.mockResolvedValue(undefined);
    addRecipientUnwrap.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AddExpenseForm />);
    fillForm();

    await user.click(screen.getByRole('button', { name: 'Добавить расход' }));

    expect(await screen.findByText('Расход добавлен!')).toBeInTheDocument();
    await waitFor(() => expect(addUserCategoryUnwrap).toHaveBeenCalledTimes(1));
    expect(addExpense).toHaveBeenCalledTimes(1);
    expect(addExpenseTitle).toHaveBeenCalledTimes(1);
    expect(addRecipient).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('date')).toHaveValue('2026-09-20');
    expect(screen.getByLabelText('amount')).toHaveValue('');
    expect(screen.getByLabelText('title')).toHaveValue('');
  });
});
