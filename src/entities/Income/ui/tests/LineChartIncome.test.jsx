import React from 'react';
import { render, screen } from '@testing-library/react';
import { LineChartIncome } from '../LineChartIncome';
import { useGetIncomesQuery } from '../../api/incomeApi';

// Мокаем хук useGetIncomesQuery
jest.mock('../../api/incomeApi');

describe('LineChartIncome компонент', () => {
  const mockIncomes = [
    {
      date: '2023-10-01T12:00:00Z',
      amount: 1000,
      source: 'Работа',
      comment: 'Премия',
    },
    {
      date: '2023-10-02T12:00:00Z',
      amount: 500,
      source: 'Фриланс',
      comment: 'Проект 1',
    },
    {
      date: '2023-10-02T15:00:00Z',
      amount: 300,
      source: 'Фриланс',
      comment: 'Проект 2',
    },
  ];

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('отображает сообщение о загрузке при isLoading', () => {
    useGetIncomesQuery.mockReturnValue({
      data: [],
      isLoading: true,
    });

    render(<LineChartIncome />);
    expect(screen.getByText('Загрузка графика...')).toBeInTheDocument();
  });

  test('отображает сообщение, если данных нет', () => {
    useGetIncomesQuery.mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(<LineChartIncome />);
    expect(
      screen.getByText('Нет данных для отображения графика'),
    ).toBeInTheDocument();
  });

  test('отображает график с правильно сгруппированными данными', () => {
    useGetIncomesQuery.mockReturnValue({
      data: mockIncomes,
      isLoading: false,
    });

    render(<LineChartIncome />);

    // Проверяем, что заголовок отображен
    expect(screen.getByText('Динамика доходов по датам')).toBeInTheDocument();

    // Получаем даты из mockIncomes и восстанавливаем их для проверки
    const grouped = mockIncomes.reduce((acc, income) => {
      const dateLabel = new Date(income.date).toLocaleDateString();
      acc[dateLabel] = (acc[dateLabel] ?? 0) + income.amount;
      return acc;
    }, {});

    Object.keys(grouped).forEach((date) => {
      // Проверяем наличие даты в компоненте (например, в оси X)
      expect(screen.getByText(date)).toBeInTheDocument();
    });
  });
});
