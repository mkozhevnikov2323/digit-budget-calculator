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

describe('AddExpenseForm', () => {
  const addExpense = jest.fn();
  const addUserCategory = jest.fn();
  const addRecipient = jest.fn();
  const addExpenseTitle = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseGetDefaultCategoriesQuery.mockReturnValue({
      data: [
        { id: 'category-1', name: 'Еда' },
        { id: 'category-2', name: 'Транспорт' },
      ],
    });
    mockUseGetUserCategoriesQuery.mockReturnValue({ data: [] });
    mockUseGetRecipientsQuery.mockReturnValue({
      data: [
        { id: 'recipient-1', name: 'Магазин' },
        { id: 'recipient-2', name: 'Кафе' },
      ],
    });
    mockUseGetExpenseTitlesQuery.mockReturnValue({
      data: [
        { id: 'title-1', name: 'Продукты' },
        { id: 'title-2', name: 'Обед' },
      ],
    });

    mockUseAddExpenseMutation.mockReturnValue([
      addExpense,
      { error: undefined },
    ]);
    mockUseAddUserCategoryMutation.mockReturnValue([addUserCategory]);
    mockUseAddRecipientMutation.mockReturnValue([addRecipient]);
    mockUseAddExpenseTitleMutation.mockReturnValue([addExpenseTitle]);
  });

  it('keeps the existing defaults without an initial draft', () => {
    render(<AddExpenseForm />);

    expect(getInput('Дата').value).toBe(
      new Date().toISOString().slice(0, 10),
    );
    expect(getInput('Сумма').value).toBe('');
    expect(getInput('Наименование').value).toBe('');
    expect(getInput('Получатель').value).toBe('');
    expect(getInput('Категория расхода').value).toBe('');
    expect(getInput('Комментарий').value).toBe('');
  });

  it('prefills only values supplied by a partial draft', () => {
    render(
      <AddExpenseForm
        initialDraft={{
          amount: 42.5,
          title: 'Такси',
          comment: 'Поездка домой',
        }}
      />,
    );

    expect(getInput('Сумма').value).toBe('42.5');
    expect(getInput('Наименование').value).toBe('Такси');
    expect(getInput('Комментарий').value).toBe('Поездка домой');
    expect(getInput('Получатель').value).toBe('');
    expect(getInput('Категория расхода').value).toBe('');
  });

  it('normalizes amount and date before initializing the form', () => {
    render(
      <AddExpenseForm
        initialDraft={{ amount: Number.POSITIVE_INFINITY, date: 'invalid' }}
      />,
    );

    expect(getInput('Сумма').value).toBe('');
    expect(getInput('Дата').value).toBe(
      new Date().toISOString().slice(0, 10),
    );
  });

  it('visibly prefills free-text Autocomplete values outside the option lists', () => {
    render(
      <AddExpenseForm
        initialDraft={{
          amount: 275.4,
          date: '2024-02-29',
          title: 'Билет в музей',
          recipient: 'Городской музей',
          category: 'Досуг',
          comment: 'Выходной',
        }}
      />,
    );

    expect(getInput('Сумма').value).toBe('275.4');
    expect(getInput('Дата').value).toBe('2024-02-29');
    expect(getInput('Наименование').value).toBe('Билет в музей');
    expect(getInput('Получатель').value).toBe('Городской музей');
    expect(getInput('Категория расхода').value).toBe('Досуг');
    expect(getInput('Комментарий').value).toBe('Выходной');

    fireEvent.change(getInput('Наименование'), {
      target: { value: 'Два билета' },
    });
    expect(getInput('Наименование').value).toBe('Два билета');

    expect(addExpense).not.toHaveBeenCalled();
    expect(addUserCategory).not.toHaveBeenCalled();
    expect(addRecipient).not.toHaveBeenCalled();
    expect(addExpenseTitle).not.toHaveBeenCalled();
  });

  it('persists edited draft values only after explicit submit', async () => {
    const unwrap = jest.fn().mockResolvedValue(undefined);
    addExpense.mockReturnValue({ unwrap });

    render(
      <AddExpenseForm
        initialDraft={{
          amount: 100,
          date: '2024-03-10',
          title: 'Продукты',
          recipient: 'Магазин',
          category: 'Еда',
          comment: 'Черновик',
        }}
      />,
    );

    expect(addExpense).not.toHaveBeenCalled();

    fireEvent.change(getInput('Сумма'), { target: { value: '250' } });
    fireEvent.change(getInput('Дата'), { target: { value: '2024-03-11' } });
    fireEvent.change(getInput('Наименование'), {
      target: { value: 'Обед' },
    });
    fireEvent.change(getInput('Получатель'), { target: { value: 'Кафе' } });
    fireEvent.change(getInput('Категория расхода'), {
      target: { value: 'Транспорт' },
    });
    fireEvent.change(getInput('Комментарий'), {
      target: { value: 'Исправлено пользователем' },
    });

    expect(addExpense).not.toHaveBeenCalled();
    submitForm();

    await waitFor(() => expect(unwrap).toHaveBeenCalledTimes(1));
    expect(addExpense).toHaveBeenCalledWith({
      amount: '250',
      date: '2024-03-11',
      title: 'Обед',
      category: 'Транспорт',
      recipient: 'Кафе',
      comment: 'Исправлено пользователем',
    });
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
