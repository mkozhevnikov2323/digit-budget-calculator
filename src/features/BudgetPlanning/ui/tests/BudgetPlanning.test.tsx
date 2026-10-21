import { fireEvent, render, screen } from '@testing-library/react';
import { useVerifiedOwner } from 'entities/User/model/useVerifiedOwner';
import { BudgetPlanning } from '../BudgetPlanning';
jest.mock('entities/User/model/useVerifiedOwner');
const owner = jest.mocked(useVerifiedOwner);
beforeEach(() => {
  owner.mockReturnValue({ status: 'verified', owner: { userId: 'a'.repeat(24), sessionGeneration: 1 } });
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-21T00:00:00Z'));
});
afterEach(() => jest.restoreAllMocks());
it('edits memory-only targets, exports explicitly and preserves the draft after invalid import', () => {
  const storage = jest.spyOn(Storage.prototype, 'setItem');
  const network = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Real transport forbidden in synthetic test'));
  render(<BudgetPlanning />); fireEvent.click(screen.getByRole('button', { name: 'Открыть локальный план' }));
  expect(screen.queryByLabelText('Экспорт JSON — скопируйте явно')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Новая годовая сумма everyday'), { target: { value: '1200' } });
  fireEvent.click(screen.getByRole('button', { name: 'Распределить everyday по 12 месяцам' }));
  expect(screen.getByLabelText('everyday месяц 1')).toHaveValue('100.00');
  fireEvent.click(screen.getByRole('button', { name: 'Экспортировать JSON по запросу' }));
  expect(screen.getByLabelText('Экспорт JSON — скопируйте явно')).toHaveDisplayValue(/budget-plan-v1/);
  fireEvent.change(screen.getByLabelText('JSON для импорта'), { target: { value: '{invalid' } });
  fireEvent.click(screen.getByRole('button', { name: 'Импортировать JSON — заменить черновик' }));
  expect(screen.getByText(/Импорт отклонён/)).toBeInTheDocument(); expect(screen.getByLabelText('everyday месяц 1')).toHaveValue('100.00');
  fireEvent.change(screen.getByLabelText('everyday месяц 1'), { target: { value: '1.005' } });
  expect(screen.getByRole('button', { name: 'Экспортировать JSON по запросу' })).toBeDisabled();
  expect(screen.getByLabelText('everyday месяц 1')).toHaveValue('1.005');
  expect(storage).not.toHaveBeenCalled(); expect(network).not.toHaveBeenCalled();
});
it('destroys local financial drafts on owner verification loss', () => {
  const view = render(<BudgetPlanning />); fireEvent.click(screen.getByRole('button', { name: 'Открыть локальный план' }));
  fireEvent.change(screen.getByLabelText('everyday месяц 1'), { target: { value: '123.45' } });
  owner.mockReturnValue({ status: 'verifying' }); view.rerender(<BudgetPlanning />);
  expect(screen.queryByLabelText('everyday месяц 1')).not.toBeInTheDocument();
  owner.mockReturnValue({ status: 'verified', owner: { userId: 'a'.repeat(24), sessionGeneration: 2 } }); view.rerender(<BudgetPlanning />);
  expect(screen.getByLabelText('everyday месяц 1')).toHaveValue('0.00');
});
it('labels suggested plans and actual comparisons as fictional', () => {
  render(<BudgetPlanning />); fireEvent.click(screen.getByRole('button', { name: 'Открыть локальный план' }));
  fireEvent.click(screen.getByRole('button', { name: 'Заменить черновик вымышленными рекомендациями на 2027' }));
  expect(screen.getByText(/не на вашей истории/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Показать вымышленный факт за январь–февраль 2027' }));
  expect(screen.getByText(/Это не реальные расходы/)).toBeInTheDocument();
  expect(screen.getByText(/Завершённых месяцев: 2/)).toBeInTheDocument();
});
