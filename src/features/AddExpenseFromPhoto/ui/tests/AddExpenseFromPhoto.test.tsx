import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
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
import type { ExpenseDraft } from 'features/AddExpense';
import { AddExpenseFromPhoto } from '../AddExpenseFromPhoto';

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

const recognizedDraft: ExpenseDraft = {
  amount: 123.45,
  date: '2026-09-20',
  title: 'Распознанная покупка',
  recipient: 'Тестовый магазин',
  category: '',
  comment: '',
};

const getInput = (label: string) =>
  screen
    .getAllByLabelText(new RegExp(label))
    .find((element): element is HTMLInputElement =>
      element.matches('input'),
    )!;

const selectImage = () => {
  const file = new File(['image'], 'receipt.png', { type: 'image/png' });
  fireEvent.change(screen.getByTestId('expense-photo-input'), {
    target: { files: [file] },
  });
  return file;
};

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
};

describe('AddExpenseFromPhoto', () => {
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
      data: [{ id: 'recipient-1', name: 'Кафе' }],
    });
    mockUseGetExpenseTitlesQuery.mockReturnValue({
      data: [{ id: 'title-1', name: 'Обед' }],
    });
    mockUseAddExpenseMutation.mockReturnValue([
      addExpense,
      { error: undefined },
    ]);
    mockUseAddUserCategoryMutation.mockReturnValue([addUserCategory]);
    mockUseAddRecipientMutation.mockReturnValue([addRecipient]);
    mockUseAddExpenseTitleMutation.mockReturnValue([addExpenseTitle]);
  });

  it('recognizes locally, mounts the review form, and persists only after submit', async () => {
    const deferred = createDeferred<ExpenseDraft>();
    const recognize = jest.fn().mockReturnValue(deferred.promise);
    const unwrap = jest.fn().mockResolvedValue(undefined);
    addExpense.mockReturnValue({ unwrap });

    render(
      <AddExpenseFromPhoto
        onCancel={jest.fn()}
        recognize={recognize}
      />,
    );

    expect(screen.getByTestId('expense-photo-input')).toHaveAttribute(
      'accept',
      'image/*',
    );

    const file = selectImage();

    expect(recognize).toHaveBeenCalledWith(file);
    expect(screen.getByText('Распознаём изображение…')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Сумма/)).not.toBeInTheDocument();
    expect(addExpense).not.toHaveBeenCalled();
    expect(addUserCategory).not.toHaveBeenCalled();
    expect(addRecipient).not.toHaveBeenCalled();
    expect(addExpenseTitle).not.toHaveBeenCalled();

    await act(async () => {
      deferred.resolve(recognizedDraft);
      await deferred.promise;
    });

    await waitFor(() =>
      expect(getInput('Наименование').value).toBe(
        'Распознанная покупка',
      ),
    );
    expect(getInput('Сумма').value).toBe('123.45');
    expect(getInput('Дата').value).toBe('2026-09-20');
    expect(getInput('Получатель').value).toBe('Тестовый магазин');
    expect(addExpense).not.toHaveBeenCalled();
    expect(addUserCategory).not.toHaveBeenCalled();
    expect(addRecipient).not.toHaveBeenCalled();
    expect(addExpenseTitle).not.toHaveBeenCalled();

    fireEvent.change(getInput('Сумма'), { target: { value: '200' } });
    fireEvent.change(getInput('Наименование'), {
      target: { value: 'Обед' },
    });
    fireEvent.change(getInput('Получатель'), { target: { value: 'Кафе' } });
    fireEvent.change(getInput('Категория расхода'), {
      target: { value: 'Еда' },
    });
    fireEvent.change(getInput('Комментарий'), {
      target: { value: 'Проверено' },
    });

    expect(addExpense).not.toHaveBeenCalled();
    fireEvent.submit(
      screen.getByRole('button', { name: 'Добавить расход' }).closest('form')!,
    );

    await waitFor(() => expect(unwrap).toHaveBeenCalledTimes(1));
    expect(addExpense).toHaveBeenCalledWith({
      amount: '200',
      date: '2026-09-20',
      title: 'Обед',
      recipient: 'Кафе',
      category: 'Еда',
      comment: 'Проверено',
    });
  });

  it('discards the local file and draft when cancelled', async () => {
    const recognize = jest.fn().mockResolvedValue(recognizedDraft);

    const Harness = () => {
      const [open, setOpen] = useState(true);

      return (
        <>
          <button onClick={() => setOpen(true)}>Открыть фото</button>
          {open && (
            <AddExpenseFromPhoto
              onCancel={() => setOpen(false)}
              recognize={recognize}
            />
          )}
        </>
      );
    };

    render(<Harness />);
    selectImage();

    await waitFor(() =>
      expect(getInput('Наименование').value).toBe(
        'Распознанная покупка',
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(screen.queryByTestId('expense-photo-input')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Открыть фото' }));

    expect(screen.getByTestId('expense-photo-input')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Сумма/)).not.toBeInTheDocument();
    expect(screen.queryByText('receipt.png')).not.toBeInTheDocument();
    expect(recognize).toHaveBeenCalledTimes(1);
    expect(addExpense).not.toHaveBeenCalled();
    expect(addUserCategory).not.toHaveBeenCalled();
    expect(addRecipient).not.toHaveBeenCalled();
    expect(addExpenseTitle).not.toHaveBeenCalled();
  });
});
