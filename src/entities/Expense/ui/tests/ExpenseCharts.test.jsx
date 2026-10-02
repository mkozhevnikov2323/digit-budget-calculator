import { render, screen } from '@testing-library/react';
import { useGetExpensesQuery } from '../../api/expenseApi';
import { BarChartExpensesByCategory } from '../BarChartExpensesByCategory';
import { LineChartExpenses } from '../LineChartExpenses';
import { LineChartExpensesByCategory } from '../LineChartExpensesByCategory';

jest.mock('../../api/expenseApi', () => ({
  useGetExpensesQuery: jest.fn(),
}));

const expenses = [
  {
    _id: 'expense-1',
    date: '2023-10-01T12:00:00Z',
    amount: 1000,
    title: 'Продукты',
    recipient: 'Магазин',
    category: 'Еда',
  },
  {
    _id: 'expense-2',
    date: '2023-10-02T12:00:00Z',
    amount: 500,
    title: 'Такси',
    recipient: 'Перевозчик',
    category: 'Транспорт',
  },
];

const emptyResponse = {
  total: 0,
  page: 1,
  limit: 20,
  expenses: [],
};

const response = {
  total: expenses.length,
  page: 1,
  limit: 20,
  expenses,
};

const cases = [
  [
    'BarChartExpensesByCategory',
    BarChartExpensesByCategory,
    'Загрузка графика...',
    'Нет данных для отображения графика',
    'Сумма расходов по категориям',
  ],
  [
    'LineChartExpenses',
    LineChartExpenses,
    'Загрузка графика расходов...',
    'Нет данных для отображения графика расходов',
    'Динамика расходов по датам',
  ],
  [
    'LineChartExpensesByCategory',
    LineChartExpensesByCategory,
    'Загрузка графика расходов по категориям...',
    'Нет данных для отображения графика расходов по категориям',
    'Динамика расходов по категориям и датам',
  ],
];

describe.each(cases)(
  '%s',
  (_name, Component, loadingMessage, emptyMessage, title) => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    test('отображает состояние загрузки', () => {
      useGetExpensesQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
      });

      render(<Component />);

      expect(screen.getByText(loadingMessage)).toBeInTheDocument();
    });

    test('отображает пустое состояние для response.expenses', () => {
      useGetExpensesQuery.mockReturnValue({
        data: emptyResponse,
        isLoading: false,
      });

      render(<Component />);

      expect(screen.getByText(emptyMessage)).toBeInTheDocument();
    });

    test('строит график по response.expenses без пагинации', () => {
      useGetExpensesQuery.mockReturnValue({
        data: response,
        isLoading: false,
      });

      render(<Component />);

      expect(screen.getByText(title)).toBeInTheDocument();
      expect(useGetExpensesQuery).toHaveBeenCalledWith({
        noPagination: true,
      });
    });
  },
);
