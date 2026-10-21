import { fireEvent, render, screen } from '@testing-library/react';
import { ExpenseForecast } from '../ExpenseForecast';
it('keeps forecasts fictional and sensitivity assumptions explicit', () => {
  render(<ExpenseForecast />);
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Показать вымышленный прогноз' }));
  expect(screen.getByText(/не ваши данные/)).toBeInTheDocument();
  expect(screen.getByRole('table', { name: 'Вымышленные оценки по слоям' })).toBeInTheDocument();
  expect(screen.getByText(/не статистический прогноз/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Сценарное изменение, целые %'), { target: { value: 'invalid' } });
  expect(screen.getByText(/Оценка недоступна/)).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
