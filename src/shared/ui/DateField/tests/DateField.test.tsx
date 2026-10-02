import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import {
  buildResetValuesKeepingDate,
  getTodayDateString,
} from 'shared/lib/utils/date';
import { DateField } from '../ui/DateField';

type FormData = {
  date: string;
  amount: number;
};

const emptyValues: Omit<FormData, 'date'> = { amount: 0 };

const TestDateForm = ({
  onSubmitSpy,
}: {
  onSubmitSpy?: (data: FormData) => void;
}) => {
  const { control, handleSubmit, reset } = useForm<FormData>({
    defaultValues: { ...emptyValues, date: getTodayDateString() },
  });

  const onSubmit = (data: FormData) => {
    onSubmitSpy?.(data);
    reset(buildResetValuesKeepingDate(emptyValues, data.date));
  };

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
    >
      <DateField<FormData>
        name="date"
        control={control}
      />
      <button type="submit">submit</button>
    </form>
  );
};

describe('DateField', () => {
  it('при первом открытии формы показывает сегодняшнюю дату', () => {
    render(<TestDateForm />);

    expect(screen.getByLabelText('Дата')).toHaveValue(getTodayDateString());
  });

  it('после сабмита сохраняет введённую пользователем дату', async () => {
    const userEnteredDate = '2023-03-08';
    const onSubmitSpy = jest.fn();
    const user = userEvent.setup();
    render(<TestDateForm onSubmitSpy={onSubmitSpy} />);

    const input = screen.getByLabelText('Дата');
    fireEvent.change(input, { target: { value: userEnteredDate } });

    await user.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() =>
      expect(onSubmitSpy).toHaveBeenCalledWith(
        expect.objectContaining({ date: userEnteredDate }),
      ),
    );
    expect(input).toHaveValue(userEnteredDate);
    expect(input).not.toHaveValue(getTodayDateString());
  });

  it('позволяет отправить несколько записей за один прошедший день', async () => {
    const pastDate = '2022-11-20';
    const onSubmitSpy = jest.fn();
    const user = userEvent.setup();
    render(<TestDateForm onSubmitSpy={onSubmitSpy} />);

    const input = screen.getByLabelText('Дата');
    fireEvent.change(input, { target: { value: pastDate } });

    await user.click(screen.getByRole('button', { name: 'submit' }));
    await waitFor(() => expect(onSubmitSpy).toHaveBeenCalledTimes(1));
    expect(input).toHaveValue(pastDate);

    await user.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() =>
      expect(onSubmitSpy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ date: pastDate }),
      ),
    );
    expect(input).toHaveValue(pastDate);
  });

  it('показывает RHF required-ошибку, если required указан явно', async () => {
    const RequiredForm = () => {
      const { control, handleSubmit } = useForm<FormData>({
        defaultValues: { ...emptyValues, date: '' },
      });

      return (
        <form
          noValidate
          onSubmit={handleSubmit(() => {})}
        >
          <DateField<FormData>
            name="date"
            control={control}
            required
          />
          <button type="submit">submit</button>
        </form>
      );
    };

    const user = userEvent.setup();
    render(<RequiredForm />);

    await user.click(screen.getByRole('button', { name: 'submit' }));

    expect(await screen.findByText('Обязательное поле')).toBeInTheDocument();
  });
});
