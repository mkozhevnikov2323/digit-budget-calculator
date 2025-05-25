import { reducer, setIncome, resetIncome } from '../incomeSlice';
import type { IncomeState, IncomeSchema } from '../types';

describe('incomeSlice', () => {
  const initialState: IncomeState = { list: null };

  const sampleIncome: IncomeSchema[] = [
    {
      id: '1',
      date: '2023-10-01T12:00:00Z',
      amount: 1000,
      source: 'Работа',
      comment: 'Премия',
    },
    {
      id: '2',
      date: '2023-10-02T12:00:00Z',
      amount: 500,
      source: 'Фриланс',
    },
  ];

  it('должен возвращать правильное начальное состояние', () => {
    expect(reducer(undefined, { type: 'UNKNOWN_ACTION' })).toEqual({
      list: null,
    });
  });

  it('должен обработать setIncome и установить список доходов', () => {
    const newState = reducer(initialState, setIncome(sampleIncome));
    expect(newState).toEqual({ list: sampleIncome });
  });

  it('должен обработать resetIncome и сбросить список до null', () => {
    const modifiedState: IncomeState = {
      list: sampleIncome,
    };
    const newState = reducer(modifiedState, resetIncome());
    expect(newState).toEqual({ list: null });
  });

  it('обработка setIncome должна заменить существующий список', () => {
    const existingState: IncomeState = {
      list: [{ id: 'old', date: '2020-01-01', amount: 0, source: 'test' }],
    };
    const newIncome: IncomeSchema[] = [
      { id: '3', date: '2023-11-01', amount: 1500, source: 'депозит' },
    ];
    const newState = reducer(existingState, setIncome(newIncome));
    expect(newState.list).toEqual(newIncome);
  });
});
