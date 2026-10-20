import { Suspense } from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useRoutes } from 'react-router';
import { classificationPreviewRoutes, RoutePath } from 'app/providers/router/routeConfig';
import { navItems } from 'widgets/MobileMenu/model/navItems';
import { Navigation } from 'widgets/Navigation/ui/Navigation';
import { MobileMenu } from 'widgets/MobileMenu/ui/MobileMenu';

const mockMobile = jest.fn(() => false);
jest.mock('@mui/material', () => ({ ...jest.requireActual('@mui/material'), useMediaQuery: () => mockMobile() }));
jest.mock('entities/User', () => ({ selectUser: () => null }), { virtual: true });
jest.mock('features/Authorization/ui/AuthButton', () => ({ AuthButton: () => <button>Войти</button> }));
jest.mock('features/Authorization/ui/LogoutButton', () => ({ LogoutButton: () => <button>Выйти</button> }));
jest.mock('pages/MainPage', () => ({ MainPage: () => null }), { virtual: true });
jest.mock('pages/IncomePage', () => ({ IncomePage: () => null }), { virtual: true });
jest.mock('pages/ExpensesPage', () => ({ ExpensesPage: () => null }), { virtual: true });
jest.mock('pages/BalancePage', () => ({ BalancePage: () => null }), { virtual: true });
jest.mock('pages/ProfilePage', () => ({ ProfilePage: () => null }), { virtual: true });
jest.mock('pages/NotFoundPage', () => ({ NotFoundPage: () => null }), { virtual: true });
jest.mock('pages/LoansPage', () => ({ LoansPage: () => null }), { virtual: true });
jest.mock('pages/AnalyticsPage', () => ({ AnalyticsPage: () => null }), { virtual: true });

const Routes = () => useRoutes(classificationPreviewRoutes);
describe('dev-only demo route and shared navigation without credentials', () => {
  let guards: jest.SpyInstance[];
  beforeEach(() => {
    mockMobile.mockReturnValue(false);
    const forbidden = () => { throw new Error('Network and credentials forbidden'); };
    guards = [jest.spyOn(globalThis,'fetch').mockImplementation(forbidden), jest.spyOn(XMLHttpRequest.prototype,'open').mockImplementation(forbidden),
      jest.spyOn(Storage.prototype,'getItem').mockImplementation(forbidden), jest.spyOn(Storage.prototype,'setItem').mockImplementation(forbidden)];
  });
  afterEach(() => { cleanup(); try { guards.forEach((guard) => expect(guard).not.toHaveBeenCalled()); } finally { jest.restoreAllMocks(); } });
  it('opens a synthetic route without Protected or live owner verification', async () => {
    render(<MemoryRouter initialEntries={['/classification-preview']}><Suspense fallback="Загрузка демонстрации"><Routes /></Suspense></MemoryRouter>);
    expect(await screen.findByRole('heading', { name:'Классификация операций', level:1 })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(3); expect(RoutePath.expenses).toBe('/expenses');
  });
  it('desktop and mobile render the exact same shared demo entry even without login', async () => {
    const entry = { label:'Классификация (демо)', path:'/classification-preview' }; expect(navItems).toContainEqual(entry);
    const desktop = render(<MemoryRouter><Navigation publicOnly /></MemoryRouter>);
    expect(screen.getByRole('link', { name:entry.label })).toHaveAttribute('href',entry.path);
    expect(screen.queryByRole('link', { name:'Расходы' })).not.toBeInTheDocument(); desktop.unmount();
    mockMobile.mockReturnValue(true); const store = configureStore({ reducer: () => ({}) });
    render(<Provider store={store}><MemoryRouter><MobileMenu /></MemoryRouter></Provider>);
    await userEvent.setup().click(screen.getByRole('button', { name:'Открыть меню' }));
    // Existing mobile items are links with an explicit button role.
    expect(screen.getByRole('button', { name:entry.label })).toHaveAttribute('href',entry.path);
    expect(screen.queryByRole('button', { name:'Расходы' })).not.toBeInTheDocument();
  });
  it('false production guard registers neither route nor shared navigation entry', () => {
    jest.isolateModules(() => {
      jest.doMock('shared/config/classificationPreview', () => ({ classificationPreviewEnabled:false, CLASSIFICATION_PREVIEW_PATH:'/classification-preview' }));
      const routes: typeof import('app/providers/router/routeConfig') = jest.requireActual('app/providers/router/routeConfig');
      const navigation: typeof import('widgets/MobileMenu/model/navItems') = jest.requireActual('widgets/MobileMenu/model/navItems');
      expect(routes.classificationPreviewRoutes).toEqual([]); expect(navigation.navItems.some((entry) => entry.path === '/classification-preview')).toBe(false);
    });
    jest.dontMock('shared/config/classificationPreview');
  });
});
