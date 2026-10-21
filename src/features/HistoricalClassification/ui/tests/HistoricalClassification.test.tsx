import { fireEvent, render, screen } from '@testing-library/react';
import { HistoricalClassification } from '../HistoricalClassification';
import { selectedPeriod } from 'features/FinancialAnalytics/model/tests/fixtures';
import { useVerifiedOwner } from 'entities/User/model/useVerifiedOwner';
import { useGetOwnedHistoryQuery, useReadOperationClassificationQuery } from '../../api/historyApi';

jest.mock('entities/User/model/useVerifiedOwner');
jest.mock('../../api/historyApi', () => ({ useGetOwnedHistoryQuery: jest.fn(), useReadOperationClassificationQuery: jest.fn() }));
const history = jest.mocked(useGetOwnedHistoryQuery), decision = jest.mocked(useReadOperationClassificationQuery);
const owner = jest.mocked(useVerifiedOwner), id = '1'.repeat(24);
const operations = [{ dataset: 'expenses', operationId: id, kopecks: 100, timestamp: Date.parse('2024-02-10T12:00:00Z'),
  facts: { amount: 1, date: '2024-02-10T12:00:00Z', category: 'Транспорт', title: 'Fictional fuel', recipient: 'Fictional station', comment: '' } }];
beforeEach(() => {
  owner.mockReturnValue({ status: 'verified', owner: { userId: 'a'.repeat(24), sessionGeneration: 1 } });
  history.mockReturnValue({ currentData: { operations }, isFetching: false, isError: false, requestId: 'load1', refetch: jest.fn() } as ReturnType<typeof useGetOwnedHistoryQuery>);
  decision.mockReturnValue({ isError: true, isFetching: false, refetch: jest.fn() } as ReturnType<typeof useReadOperationClassificationQuery>);
});
it('fetches only a selected classification, displays all facts, and never enables persistence', () => {
  render(<HistoricalClassification period={selectedPeriod()} />);
  expect(decision).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /expenses ·/ }));
  expect(decision).toHaveBeenCalled(); expect(screen.getByText(/Fictional fuel/)).toHaveTextContent('Fictional station');
  expect(screen.getByText(/Это не означает «не рассмотрена»/)).toBeInTheDocument();
  const confirm = screen.getByRole('button', { name: 'Подтвердить временный выбор' }); expect(confirm).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(confirm);
  expect(screen.getByText(/Только в памяти, на сервер не отправлен/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Сохранить на сервере/ })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Финансовый слой'), { target: { value: 'irregular' } });
  expect(confirm).toBeDisabled(); expect(screen.queryByText(/Только в памяти, на сервер не отправлен/)).not.toBeInTheDocument();
});
it('removes selected facts/drafts when authentication is no longer verified', () => {
  const view = render(<HistoricalClassification period={selectedPeriod()} />);
  fireEvent.click(screen.getByRole('button', { name: /expenses ·/ }));
  owner.mockReturnValue({ status: 'verifying' }); view.rerender(<HistoricalClassification period={selectedPeriod()} />);
  expect(screen.queryByText(/Fictional fuel/)).not.toBeInTheDocument();
});
it('does not show cached operations while history is refetching or unavailable', () => {
  history.mockReturnValue({ currentData: { operations }, isFetching: true, isError: false, refetch: jest.fn() } as ReturnType<typeof useGetOwnedHistoryQuery>);
  render(<HistoricalClassification period={selectedPeriod()} />);
  expect(screen.queryByRole('button', { name: /expenses ·/ })).not.toBeInTheDocument();
});
