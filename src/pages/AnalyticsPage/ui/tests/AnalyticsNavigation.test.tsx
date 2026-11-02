import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import AppRouter from 'app/providers/router/AppRouter';

const mockAnalytics = jest.fn(() => <div>Existing complete analytics</div>);
jest.mock('pages/AnalyticsPage', () => ({ AnalyticsPage: () => mockAnalytics() }));
jest.mock('pages/MainPage', () => ({ MainPage: () => <div>Public entry</div> }));
jest.mock('pages/IncomePage', () => ({ IncomePage: () => <div>Income page</div> }));
jest.mock('pages/ExpensesPage', () => ({ ExpensesPage: () => null }));
jest.mock('pages/BalancePage', () => ({ BalancePage: () => null }));
jest.mock('pages/ProfilePage', () => ({ ProfilePage: () => null }));
jest.mock('pages/NotFoundPage', () => ({ NotFoundPage: () => <div>Not found</div> }));
jest.mock('pages/LoansPage', () => ({ LoansPage: () => null }));

// Independent expected public contract, rather than deriving expectations from implementation.
const destinations = [
  ['/analytics', 'Расширенная аналитика'],
  ['/analytics/categories', 'Операции по категориям'],
  ['/analytics/recurrence', 'Повторяемость операций'],
  ['/analytics/similar', 'Похожие операции'],
  ['/analytics/income-sources', 'Источники поступлений'],
  ['/analytics/history', 'История операций'],
  ['/analytics/classification', 'Классификация'],
  ['/analytics/classification-stats', 'Статистика классификации'],
  ['/analytics/planning', 'Планирование бюджета'],
] as const;
const Location = () => {
  const location = useLocation(), navigate = useNavigate();
  return <><output aria-label="Current URL">{location.pathname}{location.search}</output>
    <button onClick={() => navigate(-1)}>Back</button></>;
};
const show = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRouter /><Location /></MemoryRouter>);
beforeEach(() => { localStorage.clear(); mockAnalytics.mockClear(); });
afterEach(() => localStorage.clear());

for (const [path, label] of destinations) {
  it('supports a direct protected entry and remount at ' + path, () => {
    localStorage.setItem('token', 'synthetic-navigation-only');
    const view = show(path);
    const nav = screen.getByRole('navigation', { name: 'Разделы аналитики' });
    expect(within(nav).getAllByRole('tab')).toHaveLength(9);
    expect(within(nav).getByRole('tab', { name: label, selected: true })).toHaveAttribute('aria-current', 'page');
    if (path === '/analytics') expect(screen.getByText('Existing complete analytics')).toBeInTheDocument();
    else {
      expect(screen.getByRole('heading', { name: label })).toBeInTheDocument();
      expect(screen.queryByText('Existing complete analytics')).not.toBeInTheDocument();
      expect(mockAnalytics).not.toHaveBeenCalled();
    }
    view.unmount();
    show(path);
    expect(screen.getByRole('tab', { name: label, selected: true })).toBeInTheDocument();
  });
  it('protects unauthenticated direct entry at ' + path, () => {
    show(path);
    expect(screen.getByText('Public entry')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Разделы аналитики' })).not.toBeInTheDocument();
    expect(mockAnalytics).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Current URL')).toHaveTextContent(/^\/$/);
  });
}
it('navigates using real hrefs, selects only the exact route and supports browser Back', () => {
  localStorage.setItem('token', 'synthetic-navigation-only');
  show('/analytics');
  const tab = screen.getByRole('tab', { name: 'Классификация' });
  expect(tab).toHaveAttribute('href', '/analytics/classification');
  fireEvent.click(tab);
  expect(screen.getByRole('tab', { name: 'Классификация', selected: true })).toBeInTheDocument();
  expect(screen.getAllByRole('tab', { selected: true })).toHaveLength(1);
  expect(screen.getByRole('tab', { name: 'Расширенная аналитика' })).not.toHaveAttribute('aria-current');
  expect(screen.queryByText('Existing complete analytics')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Планирование бюджета' }));
  expect(screen.getByRole('heading', { name: 'Планирование бюджета' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Классификация' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByRole('tab', { name: 'Классификация', selected: true })).toBeInTheDocument();
});
it('supports keyboard navigation and activation of linked tabs', async () => {
  localStorage.setItem('token', 'synthetic-navigation-only');
  const user = userEvent.setup();
  show('/analytics');
  act(() => screen.getByRole('tab', { name: 'Расширенная аналитика' }).focus());
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', { name: 'Операции по категориям' })).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('heading', { name: 'Операции по категориям' })).toBeInTheDocument();
});
it('normalizes trailing slash only for tab selection and keeps other routes working', () => {
  localStorage.setItem('token', 'synthetic-navigation-only');
  const view = show('/analytics/history/?existing=value');
  expect(screen.getByRole('tab', { name: 'История операций', selected: true })).toBeInTheDocument();
  expect(screen.getByLabelText('Current URL')).toHaveTextContent('/analytics/history/?existing=value');
  view.unmount(); show('/income');
  expect(screen.getByText('Income page')).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Разделы аналитики' })).not.toBeInTheDocument();
});
