import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Control, FieldValues } from 'react-hook-form';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useAddIncomeMutation } from 'entities/Income';
import { useAddUserSourceMutation } from 'entities/IncomeSource';
import { AddIncomeModal } from '../AddIncomeModal';

function mockField(exportName: string, label: string) {
  const { Controller } = jest.requireActual('react-hook-form') as typeof import('react-hook-form');
  return {
    [exportName]: ({ name, control }: { name: string; control: Control<FieldValues> }) => (
      <Controller name={name} control={control} rules={{ required: true }} render={({ field }) => (
        <input aria-label={label} value={String(field.value ?? '')} onChange={field.onChange} />
      )} />
    ),
  };
}

jest.mock('features/AddIncome', () => jest.requireActual('features/AddIncome/ui/AddIncomeForm'), { virtual: true });
jest.mock('shared/ui/Modal', () => jest.requireActual('shared/ui/Modal/ui/Modal'), { virtual: true });
jest.mock('shared/ui/DateField', () => mockField('DateField', 'Дата'), { virtual: true });
jest.mock('shared/ui/AmountField', () => mockField('AmountField', 'Сумма'), { virtual: true });
jest.mock('features/AddIncomeSource', () => mockField('IncomeSourceField', 'Источник'), { virtual: true });
jest.mock('entities/Income', () => ({ useAddIncomeMutation: jest.fn() }), { virtual: true });
jest.mock('entities/IncomeSource', () => ({
  useGetDefaultSourcesQuery: () => ({ data: [] }),
  useGetUserSourcesQuery: () => ({ data: [] }),
  useAddUserSourceMutation: jest.fn(),
}), { virtual: true });

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};
const fillForm = () => {
  fireEvent.change(screen.getByLabelText('Сумма'), { target: { value: '120' } });
  fireEvent.change(screen.getByLabelText('Источник'), { target: { value: 'Salary' } });
};
const incomeDialog = () => screen.getByRole('dialog', { name: 'Добавление дохода' });
const submit = () => screen.getByRole('button', { name: 'Добавить доход' });
// Ripple animation is unrelated to submission safety and schedules late updates.
const theme = createTheme({ components: { MuiButtonBase: { defaultProps: { disableRipple: true } } } });
const attemptClose = (mechanism: string) => {
  if (mechanism === 'button') fireEvent.click(screen.getByRole('button', { name: 'close' }));
  else if (mechanism === 'escape') fireEvent.keyDown(incomeDialog(), { key: 'Escape' });
  else {
    fireEvent.mouseDown(incomeDialog().parentElement!);
    fireEvent.click(incomeDialog().parentElement!);
  }
};

describe('AddIncomeModal submission safety', () => {
  const addIncome = jest.fn();
  const unwrap = jest.fn();
  const syncSource = jest.fn();
  const onClose = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    (useAddIncomeMutation as unknown as jest.Mock).mockReturnValue([addIncome]);
    (useAddUserSourceMutation as unknown as jest.Mock).mockReturnValue([() => ({ unwrap: syncSource })]);
    addIncome.mockReturnValue({ unwrap });
    unwrap.mockResolvedValue(undefined);
    syncSource.mockResolvedValue(undefined);
  });

  const Harness = () => {
    const [open, setOpen] = useState(true);
    return (
      <ThemeProvider theme={theme}>
        <AddIncomeModal open={open} onClose={() => { onClose(); setOpen(false); }} />
      </ThemeProvider>
    );
  };

  it.each(['button', 'escape', 'backdrop'])('blocks %s synchronously and while the POST is pending', async (mechanism) => {
    const pending = deferred();
    unwrap.mockReturnValueOnce(pending.promise);
    render(<Harness />);
    fillForm();
    act(() => {
      fireEvent.submit(submit().closest('form')!);
      attemptClose(mechanism);
    });
    await waitFor(() => expect(addIncome).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'close' })).toBeDisabled();
    attemptClose(mechanism);
    expect(onClose).not.toHaveBeenCalled();
    expect(incomeDialog()).toBeInTheDocument();
    await act(async () => pending.resolve());
    await waitFor(() => expect(screen.getByRole('button', { name: 'close' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps closing blocked until source synchronization settles', async () => {
    const pending = deferred();
    syncSource.mockReturnValueOnce(pending.promise);
    render(<Harness />);
    fillForm();
    await userEvent.click(submit());
    expect(await screen.findByText('Доход сохранён.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'close' })).toBeDisabled();
    for (const mechanism of ['button', 'escape', 'backdrop']) attemptClose(mechanism);
    expect(onClose).not.toHaveBeenCalled();
    expect(addIncome).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve());
    await waitFor(() => expect(screen.getByRole('button', { name: 'close' })).toBeEnabled());
  });

  it.each(['button', 'escape', 'backdrop'])('requires explicit confirmation to close an uncertain result by %s', async (mechanism) => {
    unwrap.mockRejectedValueOnce(new Error('Response lost'));
    render(<Harness />);
    fillForm();
    await userEvent.click(submit());
    expect(await screen.findByText(/Доход мог уже сохраниться/)).toBeVisible();
    expect(submit()).toBeDisabled();
    attemptClose(mechanism);
    const confirmation = await screen.findByRole('dialog', { name: 'Закрыть результат сохранения дохода?' });
    expect(within(confirmation).getByText(/Проверьте историю доходов/)).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(within(confirmation).getByRole('button', { name: 'Остаться' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Закрыть результат сохранения дохода?' })).not.toBeInTheDocument());
    expect(screen.getByLabelText('Сумма')).toHaveValue('120');
    expect(screen.getByLabelText('Источник')).toHaveValue('Salary');
    expect(submit()).toBeDisabled();
    attemptClose(mechanism);
    const reopened = await screen.findByRole('dialog', { name: 'Закрыть результат сохранения дохода?' });
    await userEvent.click(within(reopened).getByRole('button', { name: 'Проверю историю, закрыть' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(addIncome).toHaveBeenCalledTimes(1);
    expect(syncSource).not.toHaveBeenCalled();
  });

  it('clears the modal uncertainty guard only after acknowledgement in the form', async () => {
    unwrap.mockRejectedValueOnce(new Error('Response lost'));
    render(<Harness />);
    fillForm();
    await userEvent.click(submit());
    await userEvent.click(await screen.findByRole('button', { name: 'История проверена, продолжить ввод' }));
    attemptClose('button');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(addIncome).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Закрыть результат сохранения дохода?' })).not.toBeInTheDocument();
  });

  it('releases the close guard after validation fails without persisting', async () => {
    render(<Harness />);
    fireEvent.submit(submit().closest('form')!);
    await waitFor(() => expect(screen.getByRole('button', { name: 'close' })).toBeEnabled());
    attemptClose('button');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(addIncome).not.toHaveBeenCalled();
  });

  it('permits closing a confirmed save after an auxiliary failure without an uncertainty prompt', async () => {
    syncSource.mockRejectedValueOnce(new Error('Source failed'));
    render(<Harness />);
    fillForm();
    await userEvent.click(submit());
    expect(await screen.findByText(/Не удалось обновить подсказку источника/)).toBeVisible();
    expect(screen.getByText('Доход сохранён.')).toBeVisible();
    attemptClose('button');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(addIncome).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Закрыть результат сохранения дохода?' })).not.toBeInTheDocument();
  });
});
