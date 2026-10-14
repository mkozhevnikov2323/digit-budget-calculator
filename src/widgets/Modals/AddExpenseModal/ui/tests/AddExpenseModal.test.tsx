import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Control, FieldValues } from 'react-hook-form';
import { useAddExpenseMutation } from 'entities/Expense';
import { useAddUserCategoryMutation } from 'entities/ExpenseCategory';
import { AddExpenseModal } from '../AddExpenseModal';

function mockField(exportName: string, label: string) {
  const { Controller } = jest.requireActual('react-hook-form') as typeof import('react-hook-form');
  return { [exportName]: ({ name, control }: { name: string; control: Control<FieldValues> }) => (
    <Controller name={name} control={control} rules={{ required: true }} render={({ field }) => (
      <input aria-label={label} value={String(field.value ?? '')} onChange={field.onChange} />
    )} />
  ) };
}
jest.mock('features/AddExpense', () => jest.requireActual('features/AddExpense/ui/AddExpenseForm'), { virtual: true });
jest.mock('shared/ui/Modal', () => jest.requireActual('shared/ui/Modal/ui/Modal'), { virtual: true });
jest.mock('shared/ui/DateField', () => mockField('DateField', 'Дата'), { virtual: true });
jest.mock('shared/ui/AmountField', () => mockField('AmountField', 'Цена за штуку'), { virtual: true });
jest.mock('features/AddExpenseTitle', () => mockField('ExpenseTitleField', 'Наименование'), { virtual: true });
jest.mock('features/AddExpenseCategory', () => mockField('ExpenseCategoryField', 'Категория'), { virtual: true });
jest.mock('features/AddRecipients', () => mockField('RecipientField', 'Получатель'), { virtual: true });
jest.mock('entities/Expense', () => ({ useAddExpenseMutation: jest.fn() }), { virtual: true });
jest.mock('entities/ExpenseCategory', () => ({
  useGetDefaultCategoriesQuery: () => ({ data: [] }),
  useGetUserCategoriesQuery: () => ({ data: [] }), useAddUserCategoryMutation: jest.fn(),
}), { virtual: true });
jest.mock('entities/ExpenseTitle', () => ({
  useGetExpenseTitlesQuery: () => ({ data: [] }),
  useAddExpenseTitleMutation: () => [() => ({ unwrap: async () => undefined })],
}), { virtual: true });
jest.mock('entities/Recipient', () => ({
  useGetRecipientsQuery: () => ({ data: [] }),
  useAddRecipientMutation: () => [() => ({ unwrap: async () => undefined })],
}), { virtual: true });

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};
const fillForm = () => {
  for (const [label, value] of [['Получатель', 'Магазин'], ['Наименование', 'Молоко'], ['Категория', 'Продукты'], ['Цена за штуку', '120']]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
};
const expenseDialog = () => screen.getByRole('dialog', { name: 'Добавление расходов' });
const submit = () => screen.getByRole('button', { name: /Сохранить \d+ расходов/ });
const outsideClick = () => {
  const outsidePaper = expenseDialog().parentElement!;
  fireEvent.mouseDown(outsidePaper);
  fireEvent.click(outsidePaper);
};

describe('AddExpenseModal safety', () => {
  const addExpense = jest.fn();
  const unwrap = jest.fn();
  const syncCategory = jest.fn();
  const onClose = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    (useAddExpenseMutation as unknown as jest.Mock).mockReturnValue([addExpense]);
    (useAddUserCategoryMutation as unknown as jest.Mock).mockReturnValue([() => ({ unwrap: syncCategory })]);
    addExpense.mockImplementation(() => ({ unwrap }));
    unwrap.mockResolvedValue(undefined);
    syncCategory.mockResolvedValue(undefined);
  });

  const Harness = () => {
    const [open, setOpen] = useState(true);
    return <AddExpenseModal open={open} onClose={() => { onClose(); setOpen(false); }} />;
  };

  it('uses the expense title and a full-width lg dialog', () => {
    render(<Harness />);
    expect(expenseDialog()).toHaveClass('MuiDialog-paperWidthLg', 'MuiDialog-paperFullWidth');
    expect(screen.queryByText('Вход / Регистрация')).not.toBeInTheDocument();
  });

  it('blocks the synchronous close window, Escape, backdrop and button while POST is pending', async () => {
    const pending = deferred();
    unwrap.mockReturnValueOnce(pending.promise);
    render(<Harness />);
    fillForm();
    const closeButton = screen.getByRole('button', { name: 'close' });
    act(() => {
      fireEvent.submit(submit().closest('form')!);
      fireEvent.click(closeButton);
    });
    await waitFor(() => expect(addExpense).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
    expect(closeButton).toBeDisabled();
    fireEvent.keyDown(expenseDialog(), { key: 'Escape' });
    outsideClick();
    fireEvent.click(closeButton);
    fireEvent.submit(submit().closest('form')!);
    expect(expenseDialog()).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(addExpense).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve());
    await waitFor(() => expect(closeButton).toBeEnabled());
    await userEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('continues blocking closing during post-save dictionary synchronization', async () => {
    const pending = deferred();
    syncCategory.mockReturnValueOnce(pending.promise);
    render(<Harness />);
    fillForm();
    await userEvent.click(submit());
    expect(await screen.findByText('Сохранено расходов: 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'close' })).toBeDisabled();
    outsideClick();
    fireEvent.keyDown(expenseDialog(), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => pending.resolve());
    await waitFor(() => expect(screen.getByRole('button', { name: 'close' })).toBeEnabled());
  });

  it.each(['button', 'escape', 'backdrop'])('requires acknowledgement after partial failure through %s', async (mechanism) => {
    unwrap.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Response lost'));
    render(<Harness />);
    fillForm();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Количество' }), { target: { value: '3' } });
    await userEvent.click(submit());
    const message = await screen.findByText(/Подтверждено сохранено: 1\. Сохранение остановлено/);
    const attemptClose = async () => {
      if (mechanism === 'button') await userEvent.click(screen.getByRole('button', { name: 'close' }));
      else if (mechanism === 'escape') fireEvent.keyDown(expenseDialog(), { key: 'Escape' });
      else outsideClick();
    };
    await attemptClose();
    const confirmation = await screen.findByRole('dialog', { name: 'Закрыть результат сохранения?' });
    expect(within(confirmation).getByText(/Проверьте историю расходов/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(within(confirmation).getByRole('button', { name: 'Остаться' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Закрыть результат сохранения?' })).not.toBeInTheDocument());
    expect(message).toBeVisible();
    expect(addExpense).toHaveBeenCalledTimes(2);
    await attemptClose();
    await userEvent.click(await screen.findByRole('button', { name: 'Проверю историю, закрыть' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(addExpense).toHaveBeenCalledTimes(2);
  });
});
