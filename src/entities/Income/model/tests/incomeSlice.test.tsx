import { reducer, resetIncome, setIncome } from '../incomeSlice';
import type {
  IncomeResponse,
  IncomeSchema,
  IncomeState,
} from '../types';

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

const initialState: IncomeState = {
  list: null,
  total: 0,
  page: 1,
  limit: 20,
  year: currentYear,
  month: currentMonth,
};

const sampleIncomes: IncomeSchema[] = [
  {
    _id: '1',
    date: '2023-10-01T12:00:00Z',
    amount: 1000,
    source: 'Работа',
    comment: 'Премия',
  },
  {
    _id: '2',
    date: '2023-10-02T12:00:00Z',
    amount: 500,
    source: 'Фриланс',
  },
];

describe('incomeSlice', () => {
  it('возвращает полное начальное состояние', () => {
    expect(reducer(undefined, { type: 'UNKNOWN_ACTION' })).toEqual(
      initialState,
    );
  });

  it('сохраняет доходы и метаданные пагинации из response', () => {
    const response: IncomeResponse = {
      total: 42,
      page: 2,
      limit: 10,
      incomes: sampleIncomes,
    };

    expect(reducer(initialState, setIncome(response))).toEqual({
      ...initialState,
      list: sampleIncomes,
      total: 42,
      page: 2,
      limit: 10,
    });
  });

  it('поддерживает пустой response', () => {
    const response: IncomeResponse = {
      total: 0,
      page: 1,
      limit: 50,
      incomes: [],
    };

    expect(reducer(initialState, setIncome(response))).toEqual({
      ...initialState,
      list: [],
      limit: 50,
    });
  });

  it('очищает данные и сохраняет текущие limit и фильтры', () => {
    const populatedState: IncomeState = {
      list: sampleIncomes,
      total: 42,
      page: 3,
      limit: 10,
      year: 2024,
      month: 7,
    };

    expect(reducer(populatedState, resetIncome())).toEqual({
      list: null,
      total: 0,
      page: 1,
      limit: 10,
      year: 2024,
      month: 7,
    });
  });
});
