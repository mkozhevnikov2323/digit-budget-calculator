import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { AmountField } from '../ui/AmountField';

type FormData = {
  amount: string;
};

const TestAmountForm = ({
  onSubmitSpy,
}: {
  onSubmitSpy?: (d: FormData) => void;
}) => {
  const { control, handleSubmit } = useForm<FormData>({
    defaultValues: { amount: '' },
  });

  return (
    <form onSubmit={handleSubmit((data) => onSubmitSpy?.(data))}>
      <AmountField<FormData>
        name="amount"
        control={control}
      />
      <button type="submit">submit</button>
    </form>
  );
};

describe('AmountField', () => {
  const getInput = () => screen.getByLabelText('Сумма') as HTMLInputElement;

  it('заменяет запятую на точку', () => {
    render(<TestAmountForm />);
    fireEvent.change(getInput(), { target: { value: '10,5' } });
    expect(getInput().value).toBe('10.5');
  });

  it('срезает ведущие нули', () => {
    render(<TestAmountForm />);
    fireEvent.change(getInput(), { target: { value: '007' } });
    expect(getInput().value).toBe('7');
  });

  it('удаляет все нецифровые символы, кроме точки', () => {
    render(<TestAmountForm />);
    fireEvent.change(getInput(), { target: { value: '1a2b3c' } });
    expect(getInput().value).toBe('123');
  });

  it('не допускает больше одной точки', () => {
    render(<TestAmountForm />);
    fireEvent.change(getInput(), { target: { value: '1.2.3' } });
    expect(getInput().value).toBe('1.23');
  });

  it('показывает ошибку валидации при сумме 0 или пустом поле', async () => {
    const onSubmitSpy = jest.fn();
    render(<TestAmountForm onSubmitSpy={onSubmitSpy} />);
    fireEvent.click(screen.getByText('submit'));

    expect(await screen.findByText('Обязательное поле')).toBeInTheDocument();
    expect(onSubmitSpy).not.toHaveBeenCalled();
  });

  it('успешно отправляет форму с корректной положительной суммой', async () => {
    const onSubmitSpy = jest.fn();
    render(<TestAmountForm onSubmitSpy={onSubmitSpy} />);

    fireEvent.change(getInput(), { target: { value: '150.50' } });
    fireEvent.click(screen.getByText('submit'));

    expect(onSubmitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '150.50' }),
    );
  });
});
