import { fireEvent, render, screen, within } from '@testing-library/react';
import { RealExpenseForecast } from '../RealExpenseForecast';
import { recordedCohort } from 'features/ClassificationStatistics/model/tests/recordedFixtures';
import { useVerifiedOwner } from 'entities/User/model/useVerifiedOwner';
import { useGetCoherentHistoryQuery } from 'features/HistoricalClassification/api/historyApi';
jest.mock('entities/User/model/useVerifiedOwner');
jest.mock('features/HistoricalClassification/api/historyApi', () => ({ useGetCoherentHistoryQuery: jest.fn() }));
const owner = jest.mocked(useVerifiedOwner), query = jest.mocked(useGetCoherentHistoryQuery), now = Date.UTC(2026, 0, 2);
beforeEach(() => { owner.mockReturnValue({ status: 'verified', owner: { userId: 'a'.repeat(24), sessionGeneration: 1 } });
  query.mockReturnValue({ isFetching: false, isError: true, refetch: jest.fn() } as ReturnType<typeof useGetCoherentHistoryQuery>); });
const calculate = () => fireEvent.click(screen.getByRole('button', { name: 'Рассчитать оценку по записанной истории' }));
const confirmAll = (region?: HTMLElement) => (region ? within(region) : screen).getAllByRole('checkbox').forEach(c => fireEvent.click(c));
it('requires explicit recording attestations even for a fully populated year', () => {
  render(<RealExpenseForecast cohort={recordedCohort()} asOf={now} />); expect(screen.queryByRole('table')).not.toBeInTheDocument(); calculate();
  expect(screen.getByText(/Прогноз недоступен/)).toBeInTheDocument(); confirmAll(); calculate();
  expect(screen.getByRole('table', { name: 'Прогноз по реальным финансовым слоям' })).toHaveTextContent('12,34');
  expect(screen.getByText(/не серверное или криптографическое доказательство/)).toBeInTheDocument();
});
it('invalidates an estimate and suggestion when evidence or scenario is edited', () => {
  const onCalculated = jest.fn(); render(<RealExpenseForecast cohort={recordedCohort()} asOf={now} onCalculated={onCalculated} />);
  confirmAll(); calculate(); expect(onCalculated.mock.calls.at(-1)?.[0]?.forecast.origin).toBe('coherent_adapter');
  fireEvent.change(screen.getByLabelText('Сценарное изменение реального прогноза, целые %'), { target: { value: '10' } });
  expect(screen.queryByRole('table')).not.toBeInTheDocument(); expect(onCalculated.mock.calls.at(-1)?.[0]).toBeNull();
});
it('binds evidence to the exact accepted cohort and clears old estimates on refreshed facts', () => {
  const c = recordedCohort(), view = render(<RealExpenseForecast cohort={c} asOf={now} />); confirmAll(); calculate();
  view.rerender(<RealExpenseForecast cohort={{ ...c, observationId: 'refreshed' }} asOf={now} />);
  expect(screen.queryByRole('table')).not.toBeInTheDocument(); expect(screen.getAllByRole('checkbox').every(c => !(c as HTMLInputElement).checked)).toBe(true);
});
it('keeps partial classification and uncovered amounts explicit', () => {
  const c = recordedCohort(); c.decisions = c.decisions.map((d, i) => i === 0 ? { ...d, status: 'stale', confirmed: null } : d);
  render(<RealExpenseForecast cohort={c} asOf={now} />); confirmAll(); calculate();
  expect(screen.getByText(/Покрытие классификации: partial/)).toHaveTextContent('12,34');
});
it('requires separate recording confirmation for previous-year comparison', () => {
  const previous = recordedCohort(2024); query.mockReturnValue({ currentData: previous, isFetching: false, isError: false, requestId: 'previous1', refetch: jest.fn() } as ReturnType<typeof useGetCoherentHistoryQuery>);
  render(<RealExpenseForecast cohort={recordedCohort()} asOf={now} />); confirmAll(); calculate();
  fireEvent.click(screen.getByRole('button', { name: 'Сравнить с предыдущим полным годом' }));
  expect(screen.queryByRole('table', { name: 'Изменения подтверждённых расходов между годами' })).not.toBeInTheDocument();
  const controls = screen.getAllByRole('region', { name: 'Подтверждение полноты записи месяцев' }); confirmAll(controls[1]);
  expect(screen.getByRole('table', { name: 'Изменения подтверждённых расходов между годами' })).toHaveTextContent('0,00');
});
