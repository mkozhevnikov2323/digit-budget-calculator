import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAddExpenseMutation } from 'entities/Expense';
import { useAddUserCategoryMutation, useGetDefaultCategoriesQuery, useGetUserCategoriesQuery } from 'entities/ExpenseCategory';
import { useAddExpenseTitleMutation, useGetExpenseTitlesQuery } from 'entities/ExpenseTitle';
import { useAddRecipientMutation, useGetRecipientsQuery } from 'entities/Recipient';
import { getTodayDateString } from 'shared/lib/utils/date';
import { priceToKopecks } from '../../model/bulkExpense';
import { AddExpenseForm } from '../AddExpenseForm';
import { useMediaQuery } from '@mui/material';

// Multi-position scenarios exercise real MUI controls and responsive rerenders.
jest.setTimeout(15000);

jest.mock('@mui/material', () => ({
  ...jest.requireActual('@mui/material'), useMediaQuery: jest.fn(),
}));

jest.mock('entities/Expense', () => ({ useAddExpenseMutation: jest.fn() }), { virtual: true });
jest.mock('entities/ExpenseCategory', () => ({
  useAddUserCategoryMutation: jest.fn(), useGetDefaultCategoriesQuery: jest.fn(), useGetUserCategoriesQuery: jest.fn(),
}), { virtual: true });
jest.mock('entities/ExpenseTitle', () => ({
  useAddExpenseTitleMutation: jest.fn(), useGetExpenseTitlesQuery: jest.fn(),
}), { virtual: true });
jest.mock('entities/Recipient', () => ({
  useAddRecipientMutation: jest.fn(), useGetRecipientsQuery: jest.fn(),
}), { virtual: true });
jest.mock('features/AddExpenseTitle', () => jest.requireActual('../../../AddExpenseTitle/ui/ExpenseTitleField'), { virtual: true });
jest.mock('features/AddExpenseCategory', () => jest.requireActual('../../../AddExpenseCategory/ui/ExpenseCategoryField'), { virtual: true });
jest.mock('features/AddRecipients', () => jest.requireActual('../../../AddRecipients/ui/RecipientsField'), { virtual: true });
jest.mock('shared/ui/AmountField', () => jest.requireActual('../../../../shared/ui/AmountField/ui/AmountField'), { virtual: true });
jest.mock('shared/ui/DateField', () => jest.requireActual('../../../../shared/ui/DateField/ui/DateField'), { virtual: true });

const change = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } });
const title = (index = 0) => screen.getAllByRole('combobox', { name: /Наименование/ })[index];
const category = (index = 0) => screen.getAllByRole('combobox', { name: /Категория расхода/ })[index];
const price = (index = 0) => screen.getAllByRole('textbox', { name: /Цена за штуку/ })[index];
const quantity = (index = 0) => screen.getAllByRole('spinbutton', { name: 'Количество' })[index];
const comment = (index = 0) => screen.getAllByLabelText('Комментарий')[index];
const submit = () => screen.getByRole('button', { name: /Сохранить \d+ расходов/ });

const fillPosition = (index = 0, name = 'Молоко', cat = 'Продукты', amount = '120') => {
  change(title(index), name);
  change(category(index), cat);
  change(price(index), amount);
  const expandComment = screen.queryByRole('button', { name: `Раскрыть комментарий позиции ${index + 1}` });
  if (expandComment) fireEvent.click(expandComment);
  change(comment(index), `Комментарий ${name}`);
};
const fillForm = () => {
  change(screen.getByLabelText(/Дата/), '2026-10-13');
  change(screen.getByRole('combobox', { name: /Получатель/ }), 'Пятёрочка');
  fillPosition();
};
const payload = {
  date: '2026-10-13', recipient: 'Пятёрочка', title: 'Молоко', category: 'Продукты', amount: 120, comment: 'Комментарий Молоко',
};

describe('AddExpenseForm bulk entry', () => {
  const addExpense = jest.fn();
  const addExpenseUnwrap = jest.fn();
  const addCategory = jest.fn();
  const addCategoryUnwrap = jest.fn();
  const addTitle = jest.fn();
  const addTitleUnwrap = jest.fn();
  const addRecipient = jest.fn();
  const addRecipientUnwrap = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    (useMediaQuery as jest.Mock).mockReturnValue(false);
    (useAddExpenseMutation as jest.Mock).mockReturnValue([addExpense, {}]);
    (useAddUserCategoryMutation as jest.Mock).mockReturnValue([addCategory]);
    (useAddExpenseTitleMutation as jest.Mock).mockReturnValue([addTitle]);
    (useAddRecipientMutation as jest.Mock).mockReturnValue([addRecipient]);
    (useGetDefaultCategoriesQuery as jest.Mock).mockReturnValue({ data: [] });
    (useGetUserCategoriesQuery as jest.Mock).mockReturnValue({ data: [] });
    (useGetExpenseTitlesQuery as jest.Mock).mockReturnValue({ data: [] });
    (useGetRecipientsQuery as jest.Mock).mockReturnValue({ data: [] });
    addExpense.mockReturnValue({ unwrap: addExpenseUnwrap });
    addCategory.mockReturnValue({ unwrap: addCategoryUnwrap });
    addTitle.mockReturnValue({ unwrap: addTitleUnwrap });
    addRecipient.mockReturnValue({ unwrap: addRecipientUnwrap });
    addExpenseUnwrap.mockResolvedValue(undefined);
    addCategoryUnwrap.mockResolvedValue(undefined);
    addTitleUnwrap.mockResolvedValue(undefined);
    addRecipientUnwrap.mockResolvedValue(undefined);
  });

  it('starts with one empty position and does not persist on render/edit', () => {
    render(<AddExpenseForm />);
    expect(screen.getByLabelText(/Дата/)).toHaveValue(getTodayDateString());
    expect(quantity()).toHaveValue(1);
    expect(screen.getByRole('button', { name: 'Удалить позицию 1' })).toBeDisabled();
    fillForm();
    expect(addExpense).not.toHaveBeenCalled();
    expect(addCategory).not.toHaveBeenCalled();
    expect(addTitle).not.toHaveBeenCalled();
    expect(addRecipient).not.toHaveBeenCalled();
  });

  it('saves one unit, resets positions and recipient, and preserves date', async () => {
    render(<AddExpenseForm />);
    fillForm();
    await userEvent.click(submit());
    expect(await screen.findByText('Сохранено расходов: 1')).toBeInTheDocument();
    expect(addExpense).toHaveBeenCalledTimes(1);
    expect(addExpense).toHaveBeenCalledWith(payload);
    expect(addExpenseUnwrap).toHaveBeenCalledTimes(1);
    expect(title()).toHaveValue('');
    expect(category()).toHaveValue('');
    expect(price()).toHaveValue('');
    expect(comment()).toHaveValue('');
    expect(quantity()).toHaveValue(1);
    expect(screen.getByLabelText(/Дата/)).toHaveValue('2026-10-13');
    expect(screen.getByRole('combobox', { name: /Получатель/ })).toHaveValue('');
    expect(addExpense.mock.invocationCallOrder[0]).toBeLessThan(addCategory.mock.invocationCallOrder[0]);
    fillPosition();
    await userEvent.click(submit());
    expect(await screen.findByText('Заполните обязательные поля и проверьте цену и количество.')).toBeInTheDocument();
    expect(addExpense).toHaveBeenCalledTimes(1);
  });

  it('expands quantity 5 to five separate POSTs without quantity or client ids', async () => {
    render(<AddExpenseForm />);
    fillForm();
    change(quantity(), '5');
    await userEvent.click(submit());
    expect(await screen.findByText('Сохранено расходов: 5')).toBeInTheDocument();
    expect(addExpense).toHaveBeenCalledTimes(5);
    expect(addExpenseUnwrap).toHaveBeenCalledTimes(5);
    addExpense.mock.calls.forEach(([data]) => expect(data).toEqual(payload));
    expect(addCategory).toHaveBeenCalledTimes(1);
    expect(addTitle).toHaveBeenCalledTimes(1);
    expect(addRecipient).toHaveBeenCalledTimes(1);
  });

  it('saves independent positions with their own category, price, and comment', async () => {
    render(<AddExpenseForm />);
    fillForm();
    await userEvent.click(screen.getByRole('button', { name: 'Добавить позицию' }));
    expect(title(1)).toHaveValue('');
    expect(price(1)).toHaveValue('');
    expect(quantity(1)).toHaveValue(1);
    fillPosition(1, 'Такси', 'Транспорт', '50,25');
    await userEvent.click(submit());
    expect(await screen.findByText('Сохранено расходов: 2')).toBeInTheDocument();
    expect(addExpense).toHaveBeenNthCalledWith(1, payload);
    expect(addExpense).toHaveBeenNthCalledWith(2, {
      ...payload, title: 'Такси', category: 'Транспорт', amount: 50.25, comment: 'Комментарий Такси',
    });
  });

  it('removes a position and retains the surviving autocomplete values', async () => {
    render(<AddExpenseForm />);
    fillForm();
    await userEvent.click(screen.getByRole('button', { name: 'Добавить позицию' }));
    fillPosition(1, 'Такси', 'Транспорт', '50');
    await userEvent.click(screen.getByRole('button', { name: 'Удалить позицию 1' }));
    expect(title()).toHaveValue('Такси');
    expect(category()).toHaveValue('Транспорт');
    await userEvent.click(submit());
    expect(await screen.findByText('Сохранено расходов: 1')).toBeInTheDocument();
    expect(addExpense).toHaveBeenCalledTimes(1);
    expect(addExpense).toHaveBeenCalledWith({ ...payload, title: 'Такси', category: 'Транспорт', amount: 50, comment: 'Комментарий Такси' });
  });

  it('keeps decrement at 1 and allows independent quantity controls', async () => {
    render(<AddExpenseForm />);
    const minus = screen.getByRole('button', { name: 'Уменьшить количество позиции 1' });
    expect(minus).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Увеличить количество позиции 1' }));
    expect(quantity()).toHaveValue(2);
    await userEvent.click(minus);
    expect(quantity()).toHaveValue(1);
  });

  it('calculates decimal totals in kopecks with comma/dot input', async () => {
    render(<AddExpenseForm />);
    fillForm();
    change(price(), '0,10');
    change(quantity(), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить позицию' }));
    fillPosition(1, 'Вода', 'Продукты', '0.20');
    change(quantity(1), '2');
    expect(screen.getByText('Количество расходов: 5')).toBeInTheDocument();
    expect(screen.getByText('Сумма позиции: 0,30 ₽')).toBeInTheDocument();
    expect(screen.getByText('Сумма позиции: 0,40 ₽')).toBeInTheDocument();
    expect(screen.getByText('Итого: 0,70 ₽')).toBeInTheDocument();
  });

  it.each(['0', '-1', '1.5', ''])('rejects invalid quantity %s before POST', async (value) => {
    render(<AddExpenseForm />);
    fillForm();
    change(quantity(), value);
    await userEvent.click(submit());
    expect(await screen.findByText('Заполните обязательные поля и проверьте цену и количество.')).toBeInTheDocument();
    expect(addExpense).not.toHaveBeenCalled();
  });

  it.each(['0', '0.001', ''])('rejects invalid unit price %s before POST', async (value) => {
    render(<AddExpenseForm />);
    fillForm();
    change(price(), value);
    await userEvent.click(submit());
    expect(await screen.findByText('Заполните обязательные поля и проверьте цену и количество.')).toBeInTheDocument();
    expect(addExpense).not.toHaveBeenCalled();
  });

  it('rejects empty required fields and an empty initial form', async () => {
    render(<AddExpenseForm />);
    await userEvent.click(submit());
    expect(await screen.findByText('Заполните обязательные поля и проверьте цену и количество.')).toBeInTheDocument();
    expect(addExpense).not.toHaveBeenCalled();
    fillForm();
    change(title(), '');
    await userEvent.click(submit());
    expect(addExpense).not.toHaveBeenCalled();
  });

  it('limits the sum of quantities to 30, not just the number of positions', async () => {
    render(<AddExpenseForm />);
    fillForm();
    change(quantity(), '20');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить позицию' }));
    fillPosition(1);
    change(quantity(1), '11');
    await userEvent.click(submit());
    expect(await screen.findByText('В одном пакете допускается от 1 до 30 расходов.')).toBeInTheDocument();
    expect(addExpense).not.toHaveBeenCalled();
  });

  it('serializes POSTs and guards concurrent submit even during RHF validation', async () => {
    const onSubmissionStateChange = jest.fn();
    let resolveFirst!: () => void;
    const first = new Promise<void>((resolve) => { resolveFirst = resolve; });
    addExpenseUnwrap.mockReturnValueOnce(first);
    render(<AddExpenseForm onSubmissionStateChange={onSubmissionStateChange} />);
    fillForm();
    change(quantity(), '2');
    const form = submit().closest('form')!;
    fireEvent.submit(form);
    expect(onSubmissionStateChange).toHaveBeenLastCalledWith({ isBusy: true, hasUncertainResult: false });
    fireEvent.submit(form);
    await waitFor(() => expect(addExpense).toHaveBeenCalledTimes(1));
    expect(submit()).toBeDisabled();
    expect(addCategory).not.toHaveBeenCalled();
    fireEvent.submit(form);
    expect(addExpense).toHaveBeenCalledTimes(1);
    await act(async () => resolveFirst());
    expect(await screen.findByText('Сохранено расходов: 2')).toBeInTheDocument();
    expect(addExpense).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(onSubmissionStateChange).toHaveBeenLastCalledWith({ isBusy: false, hasUncertainResult: false }));
  });

  it('stops at the first rejected request and blocks replay until an explicit fresh entry', async () => {
    const onSubmissionStateChange = jest.fn();
    addExpenseUnwrap.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Response lost'));
    render(<AddExpenseForm onSubmissionStateChange={onSubmissionStateChange} />);
    fillForm();
    change(quantity(), '5');
    await userEvent.click(submit());
    expect(await screen.findByText(/Подтверждено сохранено: 2\. Сохранение остановлено/)).toBeInTheDocument();
    expect(addExpense).toHaveBeenCalledTimes(3);
    expect(onSubmissionStateChange).toHaveBeenLastCalledWith({ isBusy: false, hasUncertainResult: true });
    expect(screen.queryByText(/Сохранено расходов:/)).not.toBeInTheDocument();
    expect(title()).toHaveValue('Молоко');
    expect(price()).toHaveValue('120');
    expect(quantity()).toHaveValue(5);
    expect(comment()).toHaveValue('Комментарий Молоко');
    expect(screen.getByLabelText(/Дата/)).toHaveValue('2026-10-13');
    expect(screen.getByRole('combobox', { name: /Получатель/ })).toHaveValue('Пятёрочка');
    expect(submit()).toBeDisabled();
    fireEvent.submit(submit().closest('form')!);
    expect(addExpense).toHaveBeenCalledTimes(3);
    await userEvent.click(screen.getByRole('button', { name: 'Начать новый ввод' }));
    expect(onSubmissionStateChange).toHaveBeenLastCalledWith({ isBusy: false, hasUncertainResult: false });
    expect(title()).toHaveValue('');
    expect(price()).toHaveValue('');
    expect(quantity()).toHaveValue(1);
    expect(addExpense).toHaveBeenCalledTimes(3);
    await userEvent.click(submit());
    expect(addExpense).toHaveBeenCalledTimes(3);
    fillPosition(0, 'Вода', 'Продукты', '25');
    await userEvent.click(submit());
    expect(await screen.findByText('Сохранено расходов: 1')).toBeInTheDocument();
    expect(addExpense).toHaveBeenCalledTimes(4);
  });

  it('keeps all values and creates no dictionary entries when the first POST fails', async () => {
    addExpenseUnwrap.mockRejectedValue(new Error('Network failure'));
    render(<AddExpenseForm />);
    fillForm();
    await userEvent.click(submit());
    expect(await screen.findByText(/Подтверждено сохранено: 0\. Сохранение остановлено/)).toBeInTheDocument();
    expect(title()).toHaveValue('Молоко');
    expect(category()).toHaveValue('Продукты');
    expect(price()).toHaveValue('120');
    expect(comment()).toHaveValue('Комментарий Молоко');
    expect(addCategory).not.toHaveBeenCalled();
    expect(addTitle).not.toHaveBeenCalled();
    expect(addRecipient).not.toHaveBeenCalled();
    expect(screen.queryByText(/Сохранено расходов:/)).not.toBeInTheDocument();
  });

  it('deduplicates dictionaries across positions without hiding financial success on dictionary failure', async () => {
    addCategoryUnwrap.mockRejectedValue(new Error('Dictionary failed'));
    render(<AddExpenseForm />);
    fillForm();
    await userEvent.click(screen.getByRole('button', { name: 'Добавить позицию' }));
    fillPosition(1);
    await userEvent.click(submit());
    expect(await screen.findByText('Сохранено расходов: 2')).toBeInTheDocument();
    expect(await screen.findByText(/Не удалось обновить часть подсказок/)).toBeInTheDocument();
    expect(addCategory).toHaveBeenCalledTimes(1);
    expect(addTitle).toHaveBeenCalledTimes(1);
    expect(addRecipient).toHaveBeenCalledTimes(1);
    expect(addExpense.mock.invocationCallOrder[1]).toBeLessThan(addCategory.mock.invocationCallOrder[0]);
    expect(title()).toHaveValue('');
  });

  it('reuses known dictionary options without creating them again', async () => {
    (useGetUserCategoriesQuery as jest.Mock).mockReturnValue({ data: [{ name: 'Продукты' }] });
    (useGetExpenseTitlesQuery as jest.Mock).mockReturnValue({ data: [{ name: 'Молоко' }] });
    (useGetRecipientsQuery as jest.Mock).mockReturnValue({ data: [{ name: 'Пятёрочка' }] });
    render(<AddExpenseForm />);
    fillForm();
    await userEvent.click(submit());
    expect(await screen.findByText('Сохранено расходов: 1')).toBeInTheDocument();
    expect(addCategory).not.toHaveBeenCalled();
    expect(addTitle).not.toHaveBeenCalled();
    expect(addRecipient).not.toHaveBeenCalled();
  });

  it('hides comments initially and preserves them when collapsed', async () => {
    render(<AddExpenseForm />);
    expect(screen.queryByRole('textbox', { name: 'Комментарий' })).not.toBeInTheDocument();
    fillForm();
    await userEvent.click(screen.getByRole('button', { name: 'Свернуть комментарий позиции 1' }));
    expect(screen.queryByRole('textbox', { name: 'Комментарий' })).not.toBeInTheDocument();
    expect(screen.getByText('Есть комментарий')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Раскрыть комментарий позиции 1' }));
    expect(screen.getByRole('textbox', { name: 'Комментарий' })).toHaveValue('Комментарий Молоко');
    await userEvent.click(submit());
    expect(await screen.findByText('Сохранено расходов: 1')).toBeInTheDocument();
    expect(addExpense).toHaveBeenCalledWith(payload);
  });

  it('keeps recipient option selection and freeSolo typing working after reset', async () => {
    (useGetRecipientsQuery as jest.Mock).mockReturnValue({ data: [{ name: 'Пятёрочка' }] });
    render(<AddExpenseForm />);
    fillForm();
    const recipient = screen.getByRole('combobox', { name: /Получатель/ });
    change(recipient, '');
    await userEvent.type(recipient, 'Пят');
    await userEvent.click(await screen.findByRole('option', { name: 'Пятёрочка' }));
    expect(recipient).toHaveValue('Пятёрочка');
    await userEvent.click(submit());
    expect(await screen.findByText('Сохранено расходов: 1')).toBeInTheDocument();
    expect(recipient).toHaveValue('');
    change(recipient, 'Новый магазин');
    fillPosition();
    await userEvent.click(submit());
    await waitFor(() => expect(addExpense).toHaveBeenCalledTimes(2));
    expect(addExpense).toHaveBeenLastCalledWith({ ...payload, recipient: 'Новый магазин' });
    expect(recipient).toHaveValue('');
  });

  it('expands new mobile positions and preserves collapsed values across layout switches', async () => {
    (useMediaQuery as jest.Mock).mockReturnValue(true);
    const view = render(<AddExpenseForm />);
    fillForm();
    change(quantity(), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить позицию' }));
    expect(screen.getByRole('button', { name: 'Раскрыть позицию 1' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Свернуть позицию 2' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('combobox', { name: /Наименование/ })).toHaveLength(1);
    change(title(), 'Такси');
    change(category(), 'Транспорт');
    change(price(), '50');
    await userEvent.click(screen.getByRole('button', { name: 'Раскрыть позицию 1' }));
    expect(title()).toHaveValue('Молоко');
    expect(quantity()).toHaveValue(2);
    expect(comment()).toHaveValue('Комментарий Молоко');
    (useMediaQuery as jest.Mock).mockReturnValue(false);
    view.rerender(<AddExpenseForm />);
    expect(screen.getAllByRole('combobox', { name: /Наименование/ })).toHaveLength(2);
    expect(title(1)).toHaveValue('Такси');
    (useMediaQuery as jest.Mock).mockReturnValue(true);
    view.rerender(<AddExpenseForm />);
    expect(title()).toHaveValue('Молоко');
    await userEvent.click(submit());
    expect(await screen.findByText('Сохранено расходов: 3')).toBeInTheDocument();
    expect(addExpense).toHaveBeenCalledTimes(3);
    expect(addExpense).toHaveBeenNthCalledWith(1, payload);
    expect(addExpense).toHaveBeenNthCalledWith(2, payload);
    expect(addExpense).toHaveBeenNthCalledWith(3, { ...payload, title: 'Такси', category: 'Транспорт', amount: 50, comment: '' });
  });

  it('reveals the first invalid collapsed mobile position', async () => {
    (useMediaQuery as jest.Mock).mockReturnValue(true);
    render(<AddExpenseForm />);
    fillForm();
    change(price(), '0.001');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить позицию' }));
    change(title(), 'Такси');
    change(category(), 'Транспорт');
    change(price(), '50');
    await userEvent.click(submit());
    expect(await screen.findByText('Заполните обязательные поля и проверьте цену и количество.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Свернуть позицию 1' })).toHaveAttribute('aria-expanded', 'true');
    expect(price()).toHaveValue('0.001');
    expect(addExpense).not.toHaveBeenCalled();
  });

  it('reveals RHF required errors inside collapsed mobile positions', async () => {
    (useMediaQuery as jest.Mock).mockReturnValue(true);
    render(<AddExpenseForm />);
    await userEvent.click(screen.getByRole('button', { name: 'Свернуть позицию 1' }));
    await userEvent.click(submit());
    expect(await screen.findByText('Заполните обязательные поля и проверьте цену и количество.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Свернуть позицию 1' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('combobox', { name: /Наименование/ })).toBeInTheDocument();
    expect(addExpense).not.toHaveBeenCalled();
  });
});

describe('decimal money parsing', () => {
  it.each([['0.10', 10], ['123,45', 12345], ['120', 12000], ['001.2', 120]])('parses %s exactly', (input, expected) => {
    expect(priceToKopecks(input)).toBe(expected);
  });
  it.each(['', '0', '-1', 'NaN', 'Infinity', '0.001', '9007199254740992'])('rejects invalid money %s', (input) => {
    expect(priceToKopecks(input)).toBeNull();
  });
});
