import { render, screen } from '@testing-library/react';
import { MemoryRouter, useRoutes } from 'react-router';
import { AppRoutes, routeConfig } from 'app/providers/router/routeConfig';
import { navItems } from 'widgets/MobileMenu/model/navItems';

jest.mock('pages/AnalyticsPage', () => ({ AnalyticsPage: () => <div>Protected analytics content</div> }), { virtual: true });
jest.mock('pages/MainPage', () => ({ MainPage: () => null }), { virtual: true });
jest.mock('pages/IncomePage', () => ({ IncomePage: () => null }), { virtual: true });
jest.mock('pages/ExpensesPage', () => ({ ExpensesPage: () => null }), { virtual: true });
jest.mock('pages/BalancePage', () => ({ BalancePage: () => null }), { virtual: true });
jest.mock('pages/ProfilePage', () => ({ ProfilePage: () => null }), { virtual: true });
jest.mock('pages/NotFoundPage', () => ({ NotFoundPage: () => null }), { virtual: true });
jest.mock('pages/LoansPage', () => ({ LoansPage: () => null }), { virtual: true });

const Routes = () => useRoutes([routeConfig[AppRoutes.ANALYTICS], { path: '/', element: <div>Public entry</div> }]);

describe('analytics route and shared navigation', () => {
  afterEach(() => localStorage.clear());

  it('exposes /analytics to authenticated users', () => {
    localStorage.setItem('token', 'test-token');
    render(<MemoryRouter initialEntries={['/analytics']}><Routes /></MemoryRouter>);
    expect(screen.getByText('Protected analytics content')).toBeInTheDocument();
    expect(navItems).toContainEqual({ label: 'Аналитика', path: '/analytics' });
  });

  it('keeps analytics behind the existing Protected wrapper', () => {
    render(<MemoryRouter initialEntries={['/analytics']}><Routes /></MemoryRouter>);
    expect(screen.getByText('Public entry')).toBeInTheDocument();
    expect(screen.queryByText('Protected analytics content')).not.toBeInTheDocument();
  });
});
