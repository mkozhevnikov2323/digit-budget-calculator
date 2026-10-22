import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RecordedPlanActual } from '../RecordedPlanActual';
import { useVerifiedOwner } from 'entities/User/model/useVerifiedOwner';
import { useGetCoherentHistoryQuery } from 'features/HistoricalClassification/api/historyApi';
import { recordedCohort } from 'features/ClassificationStatistics/model/tests/recordedFixtures';
import { createBudgetPlan } from '../../model/plan';
import { FINANCIAL_LAYERS } from 'features/FinancialClassification/model/types';
jest.mock('entities/User/model/useVerifiedOwner');
jest.mock('features/HistoricalClassification/api/historyApi', () => ({ useGetCoherentHistoryQuery: jest.fn() }));
const owner = jest.mocked(useVerifiedOwner), query = jest.mocked(useGetCoherentHistoryQuery), now = Date.UTC(2026, 0, 2);
const plan = (year = 2025) => { const r = createBudgetPlan(year, { firstDate: `${year - 1}-01-01`, lastDate: `${year - 1}-12-31` },
  Object.fromEntries(FINANCIAL_LAYERS.map(l => [l, l === 'everyday' ? 14808 : 0])), 24000); if (!r.ok) throw Error('Fixture'); return r.value; };
const data = (extra = {}) => ({ currentData: recordedCohort(), isFetching: false, isError: false, requestId: 'actual1', refetch: jest.fn(), ...extra }) as ReturnType<typeof useGetCoherentHistoryQuery>;
beforeEach(() => { owner.mockReturnValue({ status: 'verified', owner: { userId: 'a'.repeat(24), sessionGeneration: 1 } }); query.mockReturnValue(data()); jest.spyOn(Date, 'now').mockReturnValue(now); });
afterEach(() => jest.restoreAllMocks());
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Загрузить реальные расходы года плана' }));
const attest = () => screen.getAllByRole('checkbox').filter(x => !(x as HTMLInputElement).disabled).forEach(x => fireEvent.click(x));
it('compares real confirmed layers only after separate recording evidence and keeps reserve out of actual', () => {
  render(<RecordedPlanActual plan={plan()} asOf={now} />); open(); expect(screen.queryByRole('table')).not.toBeInTheDocument(); attest();
  expect(screen.getByRole('table', { name: 'Реальный план и факт по слоям' })).toHaveTextContent('148,08');
  expect(screen.getByText(/Реальный подтверждённый факт:/)).toHaveTextContent('Отклонение (факт − план): 0,00');
});
it('refuses complete comparisons when an elapsed expense is stale/unreviewed', () => {
  const c = recordedCohort(); c.decisions = c.decisions.map((d, i) => i === 0 ? { ...d, status: 'stale', confirmed: null } : d);
  query.mockReturnValue(data({ currentData: c })); render(<RecordedPlanActual plan={plan()} asOf={now} />); open(); attest(); expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
it('discards comparison/evidence on refetch, failure or owner transition without altering plan input', async () => {
  const p = plan(), before = JSON.stringify(p), view = render(<RecordedPlanActual plan={p} asOf={now} />); open(); attest();
  const pending = data({ isFetching: true }); query.mockReturnValue(pending); view.rerender(<RecordedPlanActual plan={p} asOf={now} />);
  expect(screen.queryByRole('table')).not.toBeInTheDocument(); query.mockReturnValue(data({ requestId: 'actual2' })); view.rerender(<RecordedPlanActual plan={p} asOf={now} />);
  expect(screen.getAllByRole('checkbox').every(x => !(x as HTMLInputElement).checked)).toBe(true);
  owner.mockReturnValue({ status: 'verifying' }); view.rerender(<RecordedPlanActual plan={p} asOf={now} />);
  await waitFor(() => expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()); expect(JSON.stringify(p) === before).toBe(true);
});
it('excludes current/future months and compares only January–February in an active March year', () => {
  const asOf = Date.UTC(2026, 2, 15); jest.spyOn(Date, 'now').mockReturnValue(asOf); const c = recordedCohort(2026); c.observedAt = asOf;
  query.mockReturnValue(data({ currentData: c })); render(<RecordedPlanActual plan={plan(2026)} asOf={asOf} />); open();
  expect(screen.getAllByRole('checkbox').filter(x => !(x as HTMLInputElement).disabled)).toHaveLength(2); attest();
  expect(screen.getByText(/Завершённых месяцев: 2/)).toHaveTextContent('24,68');
});
it('does not load future-year actuals as invented zero expenses', () => {
  render(<RecordedPlanActual plan={plan(2027)} asOf={now} />); expect(screen.getByRole('button', { name: 'Загрузить реальные расходы года плана' })).toBeDisabled();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
it('rejects a cached response from another plan year before showing financial results', () => {
  render(<RecordedPlanActual plan={plan(2024)} asOf={now} />); open();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument(); expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
