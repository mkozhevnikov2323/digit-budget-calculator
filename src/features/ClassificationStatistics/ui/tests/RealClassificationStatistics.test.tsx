import { fireEvent, render, screen } from '@testing-library/react';
import { RealClassificationStatistics } from '../RealClassificationStatistics';
import { useVerifiedOwner } from 'entities/User/model/useVerifiedOwner';
import { useGetCoherentHistoryQuery } from 'features/HistoricalClassification/api/historyApi';
import { recordedCohort } from '../../model/tests/recordedFixtures';
jest.mock('entities/User/model/useVerifiedOwner');
jest.mock('features/HistoricalClassification/api/historyApi', () => ({ useGetCoherentHistoryQuery: jest.fn() }));
const owner = jest.mocked(useVerifiedOwner), query = jest.mocked(useGetCoherentHistoryQuery), cohort = recordedCohort();
const result = (extra = {}) => ({ currentData: cohort, isFetching: false, isError: false, requestId: 'cohort1', refetch: jest.fn(), ...extra }) as ReturnType<typeof useGetCoherentHistoryQuery>;
beforeEach(() => { owner.mockReturnValue({ status: 'verified', owner: { userId: cohort.history.owner, sessionGeneration: 1 } }); query.mockReturnValue(result()); });
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Загрузить реальную статистику классификации' }));
it('requires explicit loading and displays only actual coherent-origin classification totals', () => {
  render(<RealClassificationStatistics period={cohort.history.period} />); expect(screen.queryByRole('table')).not.toBeInTheDocument(); open();
  expect(screen.getByRole('region', { name: 'Классификация expenses' })).toHaveTextContent('148,08');
  expect(screen.getByRole('region', { name: 'Классификация incomes' })).toHaveTextContent('681,36');
  expect(screen.getByRole('table', { name: 'Реальные категории независимо от слоёв' })).toHaveTextContent('Транспорт');
  expect(screen.queryByText(/ДЕМО/)).not.toBeInTheDocument();
});
it('hides cached totals during refresh, failure and loss of verified owner', () => {
  const view = render(<RealClassificationStatistics period={cohort.history.period} />); open();
  for (const extra of [{ isFetching: true }, { isError: true }]) {
    query.mockReturnValue(result(extra)); view.rerender(<RealClassificationStatistics period={cohort.history.period} />);
    expect(screen.queryByRole('table', { name: 'Реальные финансовые слои' })).not.toBeInTheDocument();
  }
  owner.mockReturnValue({ status: 'verifying' }); view.rerender(<RealClassificationStatistics period={cohort.history.period} />);
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
it('explicitly refetches the whole membership protocol after user request', () => {
  const r = result(); query.mockReturnValue(r); render(<RealClassificationStatistics period={cohort.history.period} />); open();
  fireEvent.click(screen.getByRole('button', { name: 'Заново проверить состав и факты периода' })); expect(r.refetch).toHaveBeenCalledTimes(1);
});
