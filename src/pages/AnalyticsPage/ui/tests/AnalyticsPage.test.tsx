import { fireEvent, render, screen, within } from '@testing-library/react';
import { skipToken } from '@reduxjs/toolkit/query';
import { useGetExpensesQuery } from 'entities/Expense/api/expenseApi';
import { useGetIncomesQuery } from 'entities/Income/api/incomeApi';
import AnalyticsPage from '../AnalyticsPage';

jest.mock('entities/Expense/api/expenseApi', () => ({ useGetExpensesQuery: jest.fn(), useAddExpenseMutation: jest.fn() }), { virtual: true });
jest.mock('entities/Income/api/incomeApi', () => ({ useGetIncomesQuery: jest.fn(), useAddIncomeMutation: jest.fn() }), { virtual: true });
jest.mock('@mui/x-charts/BarChart', () => ({ BarChart: () => <div aria-label="График категорий" /> }));
jest.mock('@mui/x-charts/LineChart', () => ({ LineChart: () => <div aria-label="График динамики" /> }));

const mockedExpenses = useGetExpensesQuery as unknown as jest.Mock;
const mockedIncomes = useGetIncomesQuery as unknown as jest.Mock;
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const emptyExpenses = { total: 0, page: 1, limit: 0, expenses: [] };
const emptyIncomes = { total: 0, page: 1, limit: 0, incomes: [] };

describe('read-only AnalyticsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2024-02-15T12:00:00Z'));
    mockedExpenses.mockReturnValue({ currentData: emptyExpenses, isLoading: false, isFetching: false, isError: false });
    mockedIncomes.mockReturnValue({ currentData: emptyIncomes, isLoading: false, isFetching: false, isError: false });
  });
  afterEach(() => jest.useRealTimers());

  it('requests each date-scoped dataset and shows a genuine empty period', () => {
    render(<AnalyticsPage />);
    const params = { startDate: '2024-02-01T00:00:00.000Z', endDate: '2024-02-29T23:59:59.999Z', noPagination: true };
    expect(mockedExpenses).toHaveBeenCalledWith(params);
    expect(mockedIncomes).toHaveBeenCalledWith(params);
    expect(screen.getByText('За выбранный период операций нет.')).toBeInTheDocument();
  });

  it('shows recorded totals, loan disclosure and category table with charts', () => {
    mockedExpenses.mockReturnValue({ currentData: { total: 2, page: 1, limit: 2, expenses: [
      { _id: '1', amount: 0.1, date: '2024-02-01', category: 'Еда' },
      { _id: '2', amount: 0.2, date: '2024-02-01', category: 'Выдача займа' },
    ] } });
    mockedIncomes.mockReturnValue({ currentData: { total: 1, page: 1, limit: 1, incomes: [
      { _id: 'i', amount: 1, date: '2024-02-02', source: 'Возврат займа' },
    ] } });
    render(<AnalyticsPage />);
    expect(screen.getByText(/В суммы входят выдача займа/)).toBeInTheDocument();
    expect(screen.getByText('Разность сумм прихода и расхода')).toBeInTheDocument();
    expect(screen.getByText('0,70 ₽')).toBeInTheDocument();
    const table = within(screen.getByRole('table', { name: 'Расходные операции по категориям' }));
    expect(table.getByText('Выдача займа')).toBeInTheDocument();
    expect(table.getByText('0,20 ₽')).toBeInTheDocument();
    expect(screen.getByLabelText('График категорий')).toBeInTheDocument();
    expect(screen.getByLabelText('График динамики')).toBeInTheDocument();
  });

  it('does not show stale previous-period values during loading', () => {
    mockedExpenses.mockReturnValue({ data: emptyExpenses, currentData: undefined, isFetching: true });
    render(<AnalyticsPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Загрузка операций периода');
    expect(screen.queryByText('Сумма расходных операций')).not.toBeInTheDocument();
    expect(screen.queryByText('За выбранный период операций нет.')).not.toBeInTheDocument();
  });

  it.each(['expense', 'income'])('reports %s query failure instead of valid zero totals', (side) => {
    (side === 'expense' ? mockedExpenses : mockedIncomes).mockReturnValue({ currentData: undefined, isError: true });
    render(<AnalyticsPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('Итоги не рассчитаны');
    expect(screen.queryByText('Сумма расходных операций')).not.toBeInTheDocument();
  });

  it('reports incomplete API data instead of calculating partial totals', () => {
    mockedExpenses.mockReturnValue({ currentData: { ...emptyExpenses, total: 2 } });
    render(<AnalyticsPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('неполный');
    expect(screen.queryByText('За выбранный период операций нет.')).not.toBeInTheDocument();
  });

  it('reports malformed financial data', () => {
    mockedExpenses.mockReturnValue({ currentData: { total: 1, page: 1, limit: 1,
      expenses: [{ _id: '1', amount: NaN, date: '2024-02-01', category: 'Еда' }] } });
    render(<AnalyticsPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('Некорректная денежная сумма');
  });

  it('changes query dates with previous/current month, quarter, year and navigation', () => {
    render(<AnalyticsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Предыдущий месяц' }));
    expect(mockedExpenses).toHaveBeenLastCalledWith({ startDate: '2024-01-01T00:00:00.000Z', endDate: '2024-01-31T23:59:59.999Z', noPagination: true });
    fireEvent.click(screen.getByRole('button', { name: 'Текущий месяц' }));
    change('Период', 'quarter');
    change('Квартал', '4');
    change('Год', '2023');
    expect(mockedIncomes).toHaveBeenLastCalledWith({ startDate: '2023-10-01T00:00:00.000Z', endDate: '2023-12-31T23:59:59.999Z', noPagination: true });
    fireEvent.click(screen.getByRole('button', { name: 'Следующий календарный период' }));
    expect(mockedExpenses).toHaveBeenLastCalledWith({ startDate: '2024-01-01T00:00:00.000Z', endDate: '2024-03-31T23:59:59.999Z', noPagination: true });
    change('Период', 'year');
    expect(mockedIncomes).toHaveBeenLastCalledWith({ startDate: '2024-01-01T00:00:00.000Z', endDate: '2024-12-31T23:59:59.999Z', noPagination: true });
  });

  it('validates custom ranges and skips queries for reversed dates', () => {
    render(<AnalyticsPage />);
    change('Период', 'custom');
    change('Начальная дата', '2024-02-29');
    expect(mockedExpenses).toHaveBeenLastCalledWith(skipToken);
    expect(screen.getByRole('alert')).toHaveTextContent('не должна быть позже');
    change('Конечная дата', '2024-03-01');
    expect(mockedExpenses).toHaveBeenLastCalledWith({ startDate: '2024-02-29T00:00:00.000Z', endDate: '2024-03-01T23:59:59.999Z', noPagination: true });
    expect(mockedIncomes).toHaveBeenLastCalledWith({ startDate: '2024-02-29T00:00:00.000Z', endDate: '2024-03-01T23:59:59.999Z', noPagination: true });
  });

  it('never invokes persistence hooks when opening or filtering analytics', () => {
    const expenseApi = jest.requireMock('entities/Expense/api/expenseApi');
    const incomeApi = jest.requireMock('entities/Income/api/incomeApi');
    render(<AnalyticsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Предыдущий месяц' }));
    change('Период', 'year');
    expect(expenseApi.useAddExpenseMutation).not.toHaveBeenCalled();
    expect(incomeApi.useAddIncomeMutation).not.toHaveBeenCalled();
  });
});
