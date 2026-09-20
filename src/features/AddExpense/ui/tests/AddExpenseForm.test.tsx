import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAddExpenseMutation } from 'entities/Expense';
import {
  useAddUserCategoryMutation,
  useGetDefaultCategoriesQuery,
  useGetUserCategoriesQuery,
} from 'entities/ExpenseCategory';
import {
  useAddRecipientMutation,
  useGetRecipientsQuery,
} from 'entities/Recipient';
import {
  useAddExpenseTitleMutation,
  useGetExpenseTitlesQuery,
} from 'entities/ExpenseTitle';
import { AddExpenseForm } from '../AddExpenseForm';

jest.mock(
  'entities/Expense',
  () => ({ useAddExpenseMutation: jest.fn() }),
  { virtual: true },
);

jest.mock(
  'entities/ExpenseCategory',
  () => ({
    useAddUserCategoryMutation: jest.fn(),
    useGetDefaultCategoriesQuery: jest.fn(),
    useGetUserCategoriesQuery: jest.fn(),
  }),
  { virtual: true },
);

jest.mock(
  'entities/Recipient',
  () => ({
    useAddRecipientMutation: jest.fn(),
    useGetRecipientsQuery: jest.fn(),
  }),
  { virtual: true },
);

jest.mock(
  'entities/ExpenseTitle',
  () => ({
    useAddExpenseTitleMutation: jest.fn(),
    useGetExpenseTitlesQuery: jest.fn(),
  }),
  { virtual: true },
);

const mockUseAddExpenseMutation = useAddExpenseMutation as jest.Mock;
const mockUseAddUserCategoryMutation =
  useAddUserCategoryMutation as jest.Mock;
const mockUseGetDefaultCategoriesQuery =
  useGetDefaultCategoriesQuery as jest.Mock;
const mockUseGetUserCategoriesQuery = useGetUserCategoriesQuery as jest.Mock;
const mockUseAddRecipientMutation = useAddRecipientMutation as jest.Mock;
const mockUseGetRecipientsQuery = useGetRecipientsQuery as jest.Mock;
const mockUseAddExpenseTitleMutation =
  useAddExpenseTitleMutation as jest.Mock;
const mockUseGetExpenseTitlesQuery = useGetExpenseTitlesQuery as jest.Mock;

const selectedDate = '2024-03-15';

const getInput = (label: string) =>
  screen
    .getAllByLabelText(new RegExp(label))
    .find((element): element is HTMLInputElement =>
      element.matches('input'),
    )!;

const fillForm = () => {
  fireEvent.change(getInput('Дата'), { target: { value: selectedDate } });
  fireEvent.change(getInput('Сумма'), { target: { value: '125.50' } });
  fireEvent.change(getInput('Наименование'), {
    target: { value: 'Продукты' },
  });
  fireEvent.change(getInput('Получатель'), { target: { value: 'Магазин' } });
  fireEvent.change(getInput('Категория расхода'), {
    target: { value: 'Еда' },
  });
  fireEvent.change(getInput('Комментарий'), {
    target: { value: 'Еженедельная покупка' },
  });
};

const submitForm = () => {
  fireEvent.submit(screen.getByRole('button', { name: 'Добавить расход' }).closest('form')!);
};

describe('AddExpenseForm submit', () => {
  const addExpense = jest.fn();
  const addUserCategory = jest.fn();
  const addRecipient = jest.fn();
  const addExpenseTitle = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseGetDefaultCategoriesQuery.mockReturnValue({
      data: [{ id: 'category-1', name: 'Еда' }],
    });
    mockUseGetUserCategoriesQuery.mockReturnValue({ data: [] });
    mockUseGetRecipientsQuery.mockReturnValue({
      data: [{ id: 'recipient-1', name: 'Магазин' }],
    });
    mockUseGetExpenseTitlesQuery.mockReturnValue({
      data: [{ id: 'title-1', name: 'Продукты' }],
    });

    mockUseAddExpenseMutation.mockReturnValue([
      addExpense,
      { error: undefined },
    ]);
    mockUseAddUserCategoryMutation.mockReturnValue([addUserCategory]);
    mockUseAddRecipientMutation.mockReturnValue([addRecipient]);
    mockUseAddExpenseTitleMutation.mockReturnValue([addExpenseTitle]);
  });

  it('does not run success handling when expense creation rejects', async () => {
    const unwrap = jest.fn().mockRejectedValue(new Error('Request failed'));
    addExpense.mockReturnValue({ unwrap });

    render(<AddExpenseForm />);
    fillForm();
    submitForm();

    await waitFor(() => expect(unwrap).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Добавить расход' }),
      ).not.toBeDisabled(),
    );

    expect(screen.queryByText('Расход добавлен!')).not.toBeInTheDocument();
    expect(getInput('Дата').value).toBe(selectedDate);
    expect(getInput('Сумма').value).toBe('125.50');
    expect(getInput('Наименование').value).toBe('Продукты');
    expect(getInput('Получатель').value).toBe('Магазин');
    expect(getInput('Категория расхода').value).toBe('Еда');
    expect(getInput('Комментарий').value).toBe('Еженедельная покупка');
    expect(addUserCategory).not.toHaveBeenCalled();
    expect(addRecipient).not.toHaveBeenCalled();
    expect(addExpenseTitle).not.toHaveBeenCalled();
  });

  it('shows success and resets the form after expense creation succeeds', async () => {
    const unwrap = jest.fn().mockResolvedValue(undefined);
    addExpense.mockReturnValue({ unwrap });

    render(<AddExpenseForm />);
    fillForm();
    submitForm();

    await waitFor(() =>
      expect(screen.getByText('Расход добавлен!')).toBeInTheDocument(),
    );

    expect(addExpense).toHaveBeenCalledWith({
      amount: '125.50',
      date: selectedDate,
      title: 'Продукты',
      category: 'Еда',
      recipient: 'Магазин',
      comment: 'Еженедельная покупка',
    });
    expect(unwrap).toHaveBeenCalledTimes(1);
    expect(getInput('Дата').value).toBe(selectedDate);
    expect(getInput('Сумма').value).toBe('');
  });
});
