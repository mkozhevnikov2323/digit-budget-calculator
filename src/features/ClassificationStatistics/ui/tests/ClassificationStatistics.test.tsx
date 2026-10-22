import { fireEvent, render, screen } from '@testing-library/react';
import { ClassificationStatistics } from '../ClassificationStatistics';
it('exposes fictional figures only after an explicit demo action and never calls them real history', () => {
  render(<ClassificationStatistics />);
  expect(screen.getByText(/Реальные итоги по слоям недоступны/)).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Показать вымышленный пример статистики' }));
  expect(screen.getByText(/Это не ваша финансовая история/)).toBeInTheDocument();
  expect(screen.getByRole('table', { name: 'Слои и статусы вымышленных расходов' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Закрыть вымышленный/ }));
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
