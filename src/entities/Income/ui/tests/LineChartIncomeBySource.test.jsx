import React from 'react';
import { render, screen } from '@testing-library/react';
import { LineChartIncomeBySource } from '../LineChartIncomeBySource';
import { useGetIncomesQuery } from '../../api/incomeApi';

// Мокаем хук useGetIncomesQuery
jest.mock('../../api/incomeApi');

describe('LineChartIncomeBySource компонент', () => {
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
    {
      date: '2023-10-03T10:00:00Z',
      amount: 200,
      source: 'Дополнительный источник',
      comment: 'Доп коммент',
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

    render(<LineChartIncomeBySource />);
    expect(screen.getByText('Загрузка графика...')).toBeInTheDocument();
  });

  test('отображает сообщение, если данных нет', () => {
    useGetIncomesQuery.mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(<LineChartIncomeBySource />);
    expect(
      screen.getByText('Нет данных для отображения графика'),
    ).toBeInTheDocument();
  });

  test('отображает график с правильной группировкой по датам и источникам', () => {
    useGetIncomesQuery.mockReturnValue({
      data: mockIncomes,
      isLoading: false,
    });

    render(<LineChartIncomeBySource />);

    // Проверяем наличие заголовка
    expect(
      screen.getByText('Динамика доходов по источникам и датам'),
    ).toBeInTheDocument();

    // Проверка, что даты присутствуют
    const dateLabels = Array.from(
      new Set(
        mockIncomes.map((income) => new Date(income.date).toLocaleDateString()),
      ),
    );

    dateLabels.forEach((date) => {
      expect(screen.getByText(date)).toBeInTheDocument();
    });

    // Проверка, что источники присутствуют в серии
    const sources = Array.from(
      new Set(mockIncomes.map((income) => income.source)),
    );

    sources.forEach((source) => {
      expect(screen.getByText(source)).toBeInTheDocument();
    });
  });
});
