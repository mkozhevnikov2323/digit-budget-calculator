import React from 'react';
import { render, screen } from '@testing-library/react';
import { IncomeTable } from '../IncomeTable';
import { useGetIncomesQuery } from '../../api/incomeApi';

// Мокаем хук useGetIncomesQuery
jest.mock('../../api/incomeApi');

describe('IncomeTable component', () => {
  const mockIncomes = [
    {
      date: '2023-10-01T12:00:00Z',
      amount: 1000,
      source: 'Работа',
      comment: 'Премия',
    },
    {
      date: '2023-10-05T15:30:00Z',
      amount: 500,
      source: 'Фриланс',
      comment: 'Проект',
    },
  ];

  beforeEach(() => {
    // Мокаем успешное получение данных
    useGetIncomesQuery.mockReturnValue({
      data: mockIncomes,
      isLoading: false,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('отображает заголовок, кнопку экспорта и таблицу с данными', () => {
    render(<IncomeTable />);

    // Проверка заголовка
    expect(screen.getByText('Таблица доходов')).toBeInTheDocument();

    // Проверка наличия кнопки экспорта
    const exportButton = screen.getByRole('button', { name: /Экспорт в CSV/i });
    expect(exportButton).toBeInTheDocument();

    // Проверка первой строки таблицы
    expect(screen.getByText('1')).toBeInTheDocument(); // №
    expect(screen.getByText('01.10.2023')).toBeInTheDocument(); // дата
    expect(screen.getByText('1000')).toBeInTheDocument(); // сумма
    expect(screen.getByText('Работа')).toBeInTheDocument(); // источник
    expect(screen.getByText('Премия')).toBeInTheDocument(); // комментарий

    // Проверка второй строки таблицы
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('05.10.2023')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('Фриланс')).toBeInTheDocument();
    expect(screen.getByText('Проект')).toBeInTheDocument();
  });

  test('отображает сообщение при загрузке', () => {
    useGetIncomesQuery.mockReturnValue({
      data: [],
      isLoading: true,
    });

    render(<IncomeTable />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
