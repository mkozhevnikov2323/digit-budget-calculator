import { combineReducers, configureStore, UnknownAction } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from 'react-router';
import { Protected } from 'app/providers/router/ProtectedRoute';
import {
  reducer as authorizationReducer,
  setAuthenticated,
} from 'features/Authorization/model/authorizationSlice';
import { reducer as userReducer } from '../../model/userSlice';
import { useGetMeQuery } from '../../api/userApi';
import { UserProvider } from '../UserProvider';

jest.mock('../../api/userApi', () => ({
  useGetMeQuery: jest.fn(),
}));

jest.mock('shared/api/baseApi', () => ({
  baseApi: {
    util: {
      resetApiState: () => ({ type: 'api/reset' }),
    },
  },
}));

const mockedUseGetMeQuery = useGetMeQuery as unknown as jest.Mock;
const appReducer = combineReducers({
  authorization: authorizationReducer,
  user: userReducer,
});

type TestState = ReturnType<typeof appReducer>;

const rootReducer = (
  state: TestState | undefined,
  action: UnknownAction,
): TestState => appReducer(action.type === 'LOGOUT' ? undefined : state, action);

const createTestStore = () => configureStore({ reducer: rootReducer });

const CurrentLocation = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

const TestRoutes = () => (
  <Routes>
    <Route
      path="/"
      element={<CurrentLocation />}
    />
    {['/expenses', '/income', '/balance', '/loans', '/profile'].map((path) => (
      <Route
        key={path}
        path={path}
        element={
          <Protected>
            <CurrentLocation />
          </Protected>
        }
      />
    ))}
  </Routes>
);

const createTestUi = (
  path: string,
  store: ReturnType<typeof createTestStore>,
) => (
  <MemoryRouter initialEntries={[path]}>
    <Provider store={store}>
      <UserProvider>
        <TestRoutes />
      </UserProvider>
    </Provider>
  </MemoryRouter>
);

const renderAt = (
  path: string,
  store: ReturnType<typeof createTestStore>,
) => render(createTestUi(path, store));

describe('UserProvider startup navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('preserves expenses while getMe loads and after user data resolves', async () => {
    localStorage.setItem('token', 'valid-token');
    mockedUseGetMeQuery.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
    });
    const store = createTestStore();
    const view = renderAt('/expenses', store);

    expect(screen.getByTestId('location')).toHaveTextContent('/expenses');
    expect(mockedUseGetMeQuery).toHaveBeenCalledWith(undefined, {
      skip: false,
    });

    mockedUseGetMeQuery.mockReturnValue({
      data: { email: 'user@example.com' },
      error: undefined,
      isLoading: false,
    });
    view.rerender(createTestUi('/expenses', store));

    await waitFor(() => {
      expect(store.getState().user.user).toEqual({
        email: 'user@example.com',
      });
    });
    expect(screen.getByTestId('location')).toHaveTextContent('/expenses');
  });

  it('does not force another protected route to root or expenses', () => {
    localStorage.setItem('token', 'valid-token');
    mockedUseGetMeQuery.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
    });

    renderAt('/income', createTestStore());

    expect(screen.getByTestId('location')).toHaveTextContent('/income');
  });

  it('redirects a protected route to root when the token is missing', async () => {
    mockedUseGetMeQuery.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
    });

    renderAt('/expenses', createTestStore());

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/');
    });
    expect(mockedUseGetMeQuery).toHaveBeenCalledWith(undefined, {
      skip: true,
    });
  });

  it('logs out and redirects after a confirmed unauthorized getMe response', async () => {
    localStorage.setItem('token', 'expired-token');
    mockedUseGetMeQuery.mockReturnValue({
      data: undefined,
      error: { status: 401, data: { message: 'Unauthorized' } },
      isLoading: false,
    });
    const store = createTestStore();
    store.dispatch(setAuthenticated(true));

    renderAt('/expenses', store);

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/');
    });
    expect(localStorage.getItem('token')).toBeNull();
    expect(store.getState().authorization.isAuthenticated).toBe(false);
  });
});
