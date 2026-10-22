import { fireEvent, render, screen } from '@testing-library/react';
import { BudgetPlanning } from '../BudgetPlanning';
import { useVerifiedOwner } from 'entities/User/model/useVerifiedOwner';
import { recordedCohort } from 'features/ClassificationStatistics/model/tests/recordedFixtures';
import { recordingEvidenceInput } from 'features/ExpenseForecast/model/recordingEvidence';
import { forecastExpenses } from 'features/ExpenseForecast/model/forecast';
import type { RecordedForecastSuggestion } from 'features/ExpenseForecast/ui/RealExpenseForecast';
jest.mock('entities/User/model/useVerifiedOwner');
jest.mock('../RecordedPlanActual', () => ({ RecordedPlanActual: () => <div data-testid="recorded-actual-fixture" /> }));
const owner = jest.mocked(useVerifiedOwner), now = Date.UTC(2026, 9, 21);
const suggestion = (): RecordedForecastSuggestion => {
  const cohort = recordedCohort(), i = recordingEvidenceInput(cohort, Array.from({ length: 12 }, (_, n) => `2025-${String(n + 1).padStart(2, '0')}`), now);
  if (!i.ok) throw Error('Fixture'); const f = forecastExpenses(i.value, { asOf: now, adjustmentBasisPoints: 0 }); if (!f.ok) throw Error('Fixture');
  return { cohort, input: i.value, forecast: f.value };
};
beforeEach(() => { owner.mockReturnValue({ status: 'verified', owner: { userId: 'a'.repeat(24), sessionGeneration: 1 } }); jest.spyOn(Date, 'now').mockReturnValue(now); });
afterEach(() => jest.restoreAllMocks());
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Открыть локальный план' }));
const accept = () => { fireEvent.click(screen.getByLabelText('Я проверил(а) рекомендации и ограничения; ручные слои и резерв сохранить'));
  fireEvent.click(screen.getByRole('button', { name: 'Применить рекомендации к не изменённым вручную слоям' })); };
it('offers a real eligible suggestion without automatic replacement, then requires explicit review', async () => {
  const s = suggestion(); render(<BudgetPlanning realMode cohort={s.cohort} suggestion={s} />); open();
  await screen.findByTestId('recorded-actual-fixture');
  expect(screen.getByLabelText('everyday месяц 1')).toHaveValue('0.00');
  expect(screen.getByRole('button', { name: 'Применить рекомендации к не изменённым вручную слоям' })).toBeDisabled(); accept();
  expect(screen.getByLabelText('everyday месяц 1')).toHaveValue('12.34'); expect(screen.getByText(/Приняты рекомендации по записанной истории/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /вымышленными рекомендациями/ })).not.toBeInTheDocument();
});
it('preserves manual overrides including zero, separate reserve and goals', async () => {
  const s = suggestion(); render(<BudgetPlanning realMode cohort={s.cohort} suggestion={s} />); open();
  await screen.findByTestId('recorded-actual-fixture');
  for (const [label, value] of [['everyday месяц 1', '1.00'], ['everyday месяц 1', '0.00'], ['irregular месяц 1', '77.00'],
    ['major_goals месяц 1', '33.00'], ['reserve месяц 1', '44.00']]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  accept(); expect(screen.getByLabelText('everyday месяц 1')).toHaveValue('0.00'); expect(screen.getByLabelText('irregular месяц 1')).toHaveValue('77.00');
  expect(screen.getByLabelText('major_goals месяц 1')).toHaveValue('33.00'); expect(screen.getByLabelText('reserve месяц 1')).toHaveValue('44.00');
});
it('retains edited draft through history refresh/period change and never reuses an old suggestion confirmation', async () => {
  const s = suggestion(), view = render(<BudgetPlanning realMode cohort={s.cohort} suggestion={s} />); open();
  await screen.findByTestId('recorded-actual-fixture');
  fireEvent.change(screen.getByLabelText('everyday месяц 1'), { target: { value: '23.45' } });
  fireEvent.click(screen.getByLabelText('Я проверил(а) рекомендации и ограничения; ручные слои и резерв сохранить'));
  view.rerender(<BudgetPlanning realMode />); expect(screen.getByLabelText('everyday месяц 1')).toHaveValue('23.45');
  expect(screen.getByRole('button', { name: 'Применить рекомендации к не изменённым вручную слоям' })).toBeDisabled();
  const next = suggestion(); view.rerender(<BudgetPlanning realMode cohort={next.cohort} suggestion={next} />);
  expect(screen.getByRole('button', { name: 'Применить рекомендации к не изменённым вручную слоям' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Начало исторической базы'), { target: { value: '2024-01-01' } });
  expect(screen.getByLabelText('everyday месяц 1')).toHaveValue('23.45');
});
it('preserves explicit import/export and failure recovery without browser persistence or network writes', async () => {
  const s = suggestion(), storage = jest.spyOn(Storage.prototype, 'setItem'), network = jest.spyOn(globalThis, 'fetch');
  render(<BudgetPlanning realMode cohort={s.cohort} suggestion={s} />); open(); accept();
  await screen.findByTestId('recorded-actual-fixture');
  fireEvent.click(screen.getByRole('button', { name: 'Экспортировать JSON по запросу' }));
  const json = (screen.getByLabelText('Экспорт JSON — скопируйте явно') as HTMLTextAreaElement).value;
  fireEvent.change(screen.getByLabelText('JSON для импорта'), { target: { value: '{invalid' } }); fireEvent.click(screen.getByRole('button', { name: 'Импортировать JSON — заменить черновик' }));
  expect(screen.getByText(/Импорт отклонён/)).toBeInTheDocument(); expect(screen.getByLabelText('everyday месяц 1')).toHaveValue('12.34');
  fireEvent.change(screen.getByLabelText('JSON для импорта'), { target: { value: json } }); fireEvent.click(screen.getByRole('button', { name: 'Импортировать JSON — заменить черновик' }));
  expect(screen.getByText(/Защищённые ручные слои:/)).toHaveTextContent('everyday'); expect(storage).not.toHaveBeenCalled(); expect(network).not.toHaveBeenCalled();
});
