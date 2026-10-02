import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router';
import { useLoginMutation, useRegisterMutation } from '../../api/authApi';
import { AuthForm } from '../AuthForm';

jest.mock('../../api/authApi', () => ({
  useLoginMutation: jest.fn(),
  useRegisterMutation: jest.fn(),
}));

jest.mock('react-redux', () => ({
  useDispatch: jest.fn(),
}));

jest.mock('react-router', () => ({
  useNavigate: jest.fn(),
}));

const mockedUseDispatch = useDispatch as unknown as jest.Mock;
const mockedUseNavigate = useNavigate as unknown as jest.Mock;
const mockedUseLoginMutation = useLoginMutation as unknown as jest.Mock;
const mockedUseRegisterMutation = useRegisterMutation as unknown as jest.Mock;

const getPasswordInput = (name: 'password' | 'confirmPassword') => {
  const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!input) throw new Error(`${name} input was not rendered`);
  return input;
};

describe('AuthForm navigation', () => {
  const dispatch = jest.fn();
  const navigate = jest.fn();
  const login = jest.fn();
  const register = jest.fn();
  const events: string[] = [];
  let setItemSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    events.length = 0;

    dispatch.mockImplementation((action: { type: string }) => {
      events.push(`dispatch:${action.type}`);
      return action;
    });
    navigate.mockImplementation((path: string) => {
      events.push(`navigate:${path}`);
    });
    setItemSpy = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation((key: string, value: string) => {
        events.push(`storage:${key}:${value}`);
      });

    login.mockReturnValue({
      unwrap: jest.fn().mockResolvedValue({ token: 'login-token' }),
    });
    register.mockReturnValue({
      unwrap: jest.fn().mockResolvedValue({ token: 'registration-token' }),
    });

    mockedUseDispatch.mockReturnValue(dispatch);
    mockedUseNavigate.mockReturnValue(navigate);
    mockedUseLoginMutation.mockReturnValue([login, { isLoading: false }]);
    mockedUseRegisterMutation.mockReturnValue([
      register,
      { isLoading: false },
    ]);
  });

  afterEach(() => {
    setItemSpy.mockRestore();
  });

  const fillCredentials = async (includeConfirmation = false) => {
    const user = userEvent.setup();
    await user.type(
      screen.getByRole('textbox', { name: /Электронная почта/i }),
      'user@example.com',
    );
    await user.type(getPasswordInput('password'), 'password123');

    if (includeConfirmation) {
      await user.type(getPasswordInput('confirmPassword'), 'password123');
    }

    return user;
  };

  it('navigates to expenses after successful login', async () => {
    render(<AuthForm />);
    const user = await fillCredentials();

    await user.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/expenses'));
    expect(login).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password123',
    });
    expect(events).toEqual([
      'storage:token:login-token',
      'dispatch:authorization/setAuthenticated',
      'dispatch:authorization/closeAuthModal',
      'navigate:/expenses',
    ]);
  });

  it('navigates to expenses after registration and automatic login', async () => {
    render(<AuthForm />);
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: 'Нет аккаунта? Зарегистрироваться' }),
    );
    await fillCredentials(true);

    await user.click(
      screen.getByRole('button', { name: 'Зарегистрироваться' }),
    );

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/expenses'));
    expect(register).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password123',
    });
    expect(login).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password123',
    });
    expect(register.mock.invocationCallOrder[0]).toBeLessThan(
      login.mock.invocationCallOrder[0],
    );
    expect(events).toEqual([
      'storage:token:login-token',
      'dispatch:authorization/setAuthenticated',
      'dispatch:authorization/closeAuthModal',
      'navigate:/expenses',
    ]);
  });
});
