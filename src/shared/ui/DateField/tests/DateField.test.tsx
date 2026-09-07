import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import {
  getTodayDateString,
  buildResetValuesKeepingDate,
} from 'shared/lib/utils/date';
import { DateField } from '../ui/DateField';

type FormData = {
  date: string;
  amount: number;
};

const emptyValues: Omit<FormData, 'date'> = { amount: 0 };

/**
 * Тестовая форма, повторяющая ровно тот же паттерн, что используется
 * в AddExpenseForm / AddIncomeForm:
 * - при монтировании дата по умолчанию — сегодняшняя (getTodayDateString)
 * - после сабмита дата НЕ сбрасывается на "сегодня", а остаётся той,
 *   что ввёл пользователь (buildResetValuesKeepingDate)
 */
const TestDateForm = ({
  onSubmitSpy,
}: {
  onSubmitSpy?: (d: FormData) => void;
}) => {
  const { control, handleSubmit, reset } = useForm<FormData>({
    defaultValues: { ...emptyValues, date: getTodayDateString() },
  });

  const onSubmit = (data: FormData) => {
    onSubmitSpy?.(data);
    reset(buildResetValuesKeepingDate(emptyValues, data.date));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <DateField<FormData>
        name="date"
        control={control}
      />
      <button type="submit">submit</button>
    </form>
  );
};

describe('DateField', () => {
  it('при первом открытии формы (без предыдущего ввода) показывает сегодняшнюю дату', () => {
    render(<TestDateForm />);
    const input = screen.getByLabelText('Дата') as HTMLInputElement;
    expect(input.value).toBe(getTodayDateString());
  });

  it('после сабмита с изменённой датой поле сохраняет именно введённую пользователем дату, а не сегодняшнюю', () => {
    const userEnteredDate = '2023-03-08';
    const onSubmitSpy = jest.fn();
    render(<TestDateForm onSubmitSpy={onSubmitSpy} />);

    const input = screen.getByLabelText('Дата') as HTMLInputElement;

    fireEvent.change(input, { target: { value: userEnteredDate } });
    expect(input.value).toBe(userEnteredDate);

    fireEvent.click(screen.getByText('submit'));

    expect(onSubmitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ date: userEnteredDate }),
    );

    // Ключевая проверка из бага: после сабмита поле должно остаться
    // на дате, которую ввёл пользователь, а НЕ переключиться на сегодня.
    expect(input.value).toBe(userEnteredDate);
    expect(input.value).not.toBe(getTodayDateString());
  });

  it('позволяет добавить несколько записей подряд за один и тот же прошедший день без повторного ввода даты', () => {
    const pastDate = '2022-11-20';
    const onSubmitSpy = jest.fn();
    render(<TestDateForm onSubmitSpy={onSubmitSpy} />);

    const input = screen.getByLabelText('Дата') as HTMLInputElement;

    fireEvent.change(input, { target: { value: pastDate } });
    fireEvent.click(screen.getByText('submit'));
    expect(input.value).toBe(pastDate);

    fireEvent.click(screen.getByText('submit'));

    expect(onSubmitSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ date: pastDate }),
    );
    expect(input.value).toBe(pastDate);
  });

  it('поддерживает required с сообщением об ошибке, если явно указано', () => {
    const RequiredForm = () => {
      const { control, handleSubmit } = useForm<FormData>({
        defaultValues: { ...emptyValues, date: '' },
      });
      return (
        <form onSubmit={handleSubmit(() => {})}>
          <DateField<FormData>
            name="date"
            control={control}
            required
          />
          <button type="submit">submit</button>
        </form>
      );
    };

    render(<RequiredForm />);
    fireEvent.click(screen.getByText('submit'));

    expect(screen.findByText('Обязательное поле')).toBeTruthy();
  });
});
