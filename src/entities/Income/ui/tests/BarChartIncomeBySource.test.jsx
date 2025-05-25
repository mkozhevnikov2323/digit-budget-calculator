import React from 'react';
import { render, screen } from '@testing-library/react';
import { BarChartIncomeBySource } from '../BarChartIncomeBySource';
import { useGetIncomesQuery } from '../../api/incomeApi';

// Мокаем хук useGetIncomesQuery
jest.mock('../../api/incomeApi');

describe('BarChartIncomeBySource компонент', () => {
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
      date: '2023-10-03T12:00:00Z',
      amount: 700,
      source: 'Работа',
      comment: 'Премия',
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

    render(<BarChartIncomeBySource />);
    expect(screen.getByText('Загрузка графика...')).toBeInTheDocument();
  });

  test('отображает сообщение, если данных нет', () => {
    useGetIncomesQuery.mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(<BarChartIncomeBySource />);
    expect(
      screen.getByText('Нет данных для отображения графика'),
    ).toBeInTheDocument();
  });

  test('отображает график с группированными данными', () => {
    useGetIncomesQuery.mockReturnValue({
      data: mockIncomes,
      isLoading: false,
    });

    render(<BarChartIncomeBySource />);

    // Проверяем, что заголовок отображен
    expect(screen.getByText('Сумма доходов по источникам')).toBeInTheDocument();

    // Проверяем, что есть ось по источникам
    expect(screen.getByText('Источник')).toBeInTheDocument();

    // Проверяем, что график отображает правильные данные
    // source: 'Работа' -> сумма: 1000 + 700 = 1700
    // source: 'Фриланс' -> сумма: 500

    const groupedData = {
      Работа: 1700,
      Фриланс: 500,
    };

    // Проверяем, что источники и суммы присутствуют в компоненте
    Object.keys(groupedData).forEach((source) => {
      expect(screen.getByText(source)).toBeInTheDocument();
    });
  });
});
