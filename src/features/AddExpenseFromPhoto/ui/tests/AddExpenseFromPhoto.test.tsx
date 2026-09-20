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

    await waitFor(() =>
      expect(screen.getByText('Расход добавлен!')).toBeInTheDocument(),
    );
    expect(unwrap).toHaveBeenCalledTimes(1);
    expect(addExpense).toHaveBeenCalledWith({
      amount: '200',
      date: '2026-09-20',
      title: 'Обед',
      recipient: 'Кафе',
      category: 'Еда',
      comment: 'Проверено',
    });
    expect(getInput('Сумма').value).toBe('');
    expect(getInput('Дата').value).toBe('2026-09-20');
  });

  it('keeps reviewed values and skips success handling when submit rejects', async () => {
    const recognize = jest.fn().mockResolvedValue(recognizedDraft);
    const unwrap = jest.fn().mockRejectedValue(new Error('Request failed'));
    addExpense.mockReturnValue({ unwrap });

    render(
      <AddExpenseFromPhoto
        onCancel={jest.fn()}
        recognize={recognize}
      />,
    );

    selectImage();
    await waitFor(() =>
      expect(getInput('Наименование').value).toBe(
        'Распознанная покупка',
      ),
    );

    fireEvent.change(getInput('Сумма'), { target: { value: '321' } });
    fireEvent.change(getInput('Наименование'), {
      target: { value: 'Обед' },
    });
    fireEvent.change(getInput('Получатель'), { target: { value: 'Кафе' } });
    fireEvent.change(getInput('Категория расхода'), {
      target: { value: 'Еда' },
    });
    fireEvent.change(getInput('Комментарий'), {
      target: { value: 'Оставить после ошибки' },
    });

    fireEvent.submit(
      screen.getByRole('button', { name: 'Добавить расход' }).closest('form')!,
    );

    await waitFor(() => expect(unwrap).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Добавить расход' }),
      ).not.toBeDisabled(),
    );

    expect(addExpense).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Расход добавлен!')).not.toBeInTheDocument();
    expect(getInput('Сумма').value).toBe('321');
    expect(getInput('Дата').value).toBe('2026-09-20');
    expect(getInput('Наименование').value).toBe('Обед');
    expect(getInput('Получатель').value).toBe('Кафе');
    expect(getInput('Категория расхода').value).toBe('Еда');
    expect(getInput('Комментарий').value).toBe('Оставить после ошибки');
    expect(addUserCategory).not.toHaveBeenCalled();
    expect(addRecipient).not.toHaveBeenCalled();
    expect(addExpenseTitle).not.toHaveBeenCalled();
  });

  it('normalizes a partial recognized draft before review', async () => {
    const recognize = jest.fn().mockResolvedValue({
      amount: Number.POSITIVE_INFINITY,
      date: 'invalid-date',
      title: 'Свободный текст',
    });

    render(
      <AddExpenseFromPhoto
        onCancel={jest.fn()}
        recognize={recognize}
      />,
    );

    selectImage();

    await waitFor(() =>
      expect(getInput('Наименование').value).toBe('Свободный текст'),
    );
    expect(getInput('Сумма').value).toBe('');
    expect(getInput('Дата').value).toBe(
      new Date().toISOString().slice(0, 10),
    );
    expect(getInput('Получатель').value).toBe('');
    expect(getInput('Категория расхода').value).toBe('');
    expect(getInput('Комментарий').value).toBe('');
    expect(addExpense).not.toHaveBeenCalled();
    expect(addUserCategory).not.toHaveBeenCalled();
    expect(addRecipient).not.toHaveBeenCalled();
    expect(addExpenseTitle).not.toHaveBeenCalled();
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

  it('ignores a pending recognition result after cancellation', async () => {
    const deferred = createDeferred<ExpenseDraft>();
    const recognize = jest.fn().mockReturnValue(deferred.promise);
    const onCancel = jest.fn();

    render(
      <AddExpenseFromPhoto
        onCancel={onCancel}
        recognize={recognize}
      />,
    );

    selectImage();
    expect(screen.getByText('Распознаём изображение…')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve(recognizedDraft);
      await deferred.promise;
    });

    expect(screen.queryByLabelText(/Сумма/)).not.toBeInTheDocument();
    expect(screen.queryByText('receipt.png')).not.toBeInTheDocument();
    expect(screen.queryByText('Распознаём изображение…')).not.toBeInTheDocument();
    expect(addExpense).not.toHaveBeenCalled();
    expect(addUserCategory).not.toHaveBeenCalled();
    expect(addRecipient).not.toHaveBeenCalled();
    expect(addExpenseTitle).not.toHaveBeenCalled();
  });

  it('does not start another recognition while one is pending', () => {
    const deferred = createDeferred<ExpenseDraft>();
    const recognize = jest.fn().mockReturnValue(deferred.promise);

    render(
      <AddExpenseFromPhoto
        onCancel={jest.fn()}
        recognize={recognize}
      />,
    );

    selectImage();

    expect(screen.getByRole('status')).toHaveTextContent(
      'Распознаём изображение…',
    );
    expect(screen.getByTestId('expense-photo-input')).toBeDisabled();

    const secondFile = new File(['second image'], 'second.png', {
      type: 'image/png',
    });
    fireEvent.change(screen.getByTestId('expense-photo-input'), {
      target: { files: [secondFile] },
    });

    expect(recognize).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText(/Сумма/)).not.toBeInTheDocument();
    expect(addExpense).not.toHaveBeenCalled();
  });

  it('shows an error and allows retry without persistence', async () => {
    const recognize = jest
      .fn()
      .mockRejectedValueOnce(new Error('Recognition failed'))
      .mockResolvedValueOnce(recognizedDraft);

    render(
      <AddExpenseFromPhoto
        onCancel={jest.fn()}
        recognize={recognize}
      />,
    );

    selectImage();

    expect(
      await screen.findByText(
        'Не удалось распознать изображение. Выберите другой файл.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/Сумма/)).not.toBeInTheDocument();

    selectImage();

    await waitFor(() =>
      expect(getInput('Наименование').value).toBe(
        'Распознанная покупка',
      ),
    );
    expect(recognize).toHaveBeenCalledTimes(2);
    expect(addExpense).not.toHaveBeenCalled();
    expect(addUserCategory).not.toHaveBeenCalled();
    expect(addRecipient).not.toHaveBeenCalled();
    expect(addExpenseTitle).not.toHaveBeenCalled();
  });

  it('rejects a non-image file locally without recognition or persistence', () => {
    const recognize = jest.fn();

    render(
      <AddExpenseFromPhoto
        onCancel={jest.fn()}
        recognize={recognize}
      />,
    );

    const file = new File(['text'], 'receipt.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByTestId('expense-photo-input'), {
      target: { files: [file] },
    });

    expect(screen.getByText('Выберите файл изображения.')).toBeInTheDocument();
    expect(screen.queryByText('receipt.txt')).not.toBeInTheDocument();
    expect(recognize).not.toHaveBeenCalled();
    expect(addExpense).not.toHaveBeenCalled();
    expect(addUserCategory).not.toHaveBeenCalled();
    expect(addRecipient).not.toHaveBeenCalled();
    expect(addExpenseTitle).not.toHaveBeenCalled();
  });

  it('replaces the selected image and removes the previous draft while recognizing', async () => {
    const nextRecognition = createDeferred<ExpenseDraft>();
    const recognize = jest
      .fn()
      .mockResolvedValueOnce(recognizedDraft)
      .mockReturnValueOnce(nextRecognition.promise);

    render(
      <AddExpenseFromPhoto
        onCancel={jest.fn()}
        recognize={recognize}
      />,
    );

    selectImage();
    await waitFor(() =>
      expect(getInput('Наименование').value).toBe(
        'Распознанная покупка',
      ),
    );

    const replacement = new File(['new image'], 'replacement.jpg', {
      type: 'image/jpeg',
    });
    fireEvent.change(screen.getByTestId('expense-photo-input'), {
      target: { files: [replacement] },
    });

    expect(screen.getByText('replacement.jpg')).toBeInTheDocument();
    expect(screen.queryByText('receipt.png')).not.toBeInTheDocument();
    expect(screen.getByText('Распознаём изображение…')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Сумма/)).not.toBeInTheDocument();
    expect(addExpense).not.toHaveBeenCalled();

    const replacementDraft = {
      ...recognizedDraft,
      title: 'Новая распознанная покупка',
    };
    await act(async () => {
      nextRecognition.resolve(replacementDraft);
      await nextRecognition.promise;
    });

    await waitFor(() =>
      expect(getInput('Наименование').value).toBe(
        'Новая распознанная покупка',
      ),
    );
    expect(recognize).toHaveBeenNthCalledWith(2, replacement);
    expect(addExpense).not.toHaveBeenCalled();
  });
});
