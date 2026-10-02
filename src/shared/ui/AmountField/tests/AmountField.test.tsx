import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { AmountField } from '../ui/AmountField';

type FormData = {
  amount: string;
};

const TestAmountForm = ({
  onSubmitSpy,
}: {
  onSubmitSpy?: (data: FormData) => void;
}) => {
  const { control, handleSubmit } = useForm<FormData>({
    defaultValues: { amount: '' },
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((data) => onSubmitSpy?.(data))}
    >
      <AmountField<FormData>
        name="amount"
        control={control}
      />
      <button type="submit">submit</button>
    </form>
  );
};

describe('AmountField', () => {
  const getInput = () =>
    screen.getByRole('textbox', { name: /Сумма/ }) as HTMLInputElement;

  it('заменяет запятую на точку', () => {
    render(<TestAmountForm />);
    fireEvent.change(getInput(), { target: { value: '10,5' } });
    expect(getInput()).toHaveValue('10.5');
  });

  it('срезает ведущие нули', () => {
    render(<TestAmountForm />);
    fireEvent.change(getInput(), { target: { value: '007' } });
    expect(getInput()).toHaveValue('7');
  });

  it('удаляет все нецифровые символы, кроме точки', () => {
    render(<TestAmountForm />);
    fireEvent.change(getInput(), { target: { value: '1a2b3c' } });
    expect(getInput()).toHaveValue('123');
  });

  it('не допускает больше одной точки', () => {
    render(<TestAmountForm />);
    fireEvent.change(getInput(), { target: { value: '1.2.3' } });
    expect(getInput()).toHaveValue('1.23');
  });

  it('показывает RHF validation error для пустого поля', async () => {
    const onSubmitSpy = jest.fn();
    const user = userEvent.setup();
    render(<TestAmountForm onSubmitSpy={onSubmitSpy} />);

    await user.click(screen.getByRole('button', { name: 'submit' }));

    expect(await screen.findByText('Обязательное поле')).toBeInTheDocument();
    expect(onSubmitSpy).not.toHaveBeenCalled();
  });

  it('отправляет корректную положительную сумму', async () => {
    const onSubmitSpy = jest.fn();
    const user = userEvent.setup();
    render(<TestAmountForm onSubmitSpy={onSubmitSpy} />);

    fireEvent.change(getInput(), { target: { value: '150.50' } });
    await user.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() =>
      expect(onSubmitSpy).toHaveBeenCalledWith(
        expect.objectContaining({ amount: '150.50' }),
      ),
    );
  });
});
