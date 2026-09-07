import { getTodayDateString, buildResetValuesKeepingDate } from '../date';

describe('getTodayDateString', () => {
  it('возвращает сегодняшнюю дату в формате YYYY-MM-DD', () => {
    const expected = new Date().toISOString().slice(0, 10);
    expect(getTodayDateString()).toBe(expected);
  });

  it('возвращает строку длиной 10 символов формата YYYY-MM-DD', () => {
    expect(getTodayDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('пересчитывает значение при каждом вызове, а не кэширует один и тот же Date', () => {
    const realDate = Date;
    const fixedIso = '2024-01-15T10:00:00.000Z';

    class MockDate extends realDate {
      constructor() {
        super(fixedIso);
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.Date = MockDate as any;

    expect(getTodayDateString()).toBe('2024-01-15');

    global.Date = realDate;
  });
});

describe('buildResetValuesKeepingDate', () => {
  type FormData = {
    date: string;
    amount: number;
    comment?: string;
  };

  const emptyValues: Omit<FormData, 'date'> = {
    amount: 0,
    comment: '',
  };

  it('сохраняет переданную (последнюю введённую) дату, а не сегодняшнюю', () => {
    const submittedDate = '2023-03-08';
    const result = buildResetValuesKeepingDate<FormData>(
      emptyValues,
      submittedDate,
    );

    expect(result.date).toBe(submittedDate);
    expect(result.date).not.toBe(getTodayDateString());
  });

  it('обнуляет остальные поля формы, не трогая дату', () => {
    const nonEmptyValues: Omit<FormData, 'date'> = {
      amount: 500,
      comment: 'какой-то комментарий',
    };
    const result = buildResetValuesKeepingDate<FormData>(
      emptyValues,
      '2023-03-08',
    );

    expect(result).not.toEqual({ ...nonEmptyValues, date: '2023-03-08' });
    expect(result).toEqual({ ...emptyValues, date: '2023-03-08' });
  });

  it('если пользователь вводил сегодняшнюю дату, она так и остаётся сегодняшней', () => {
    const today = getTodayDateString();
    const result = buildResetValuesKeepingDate<FormData>(emptyValues, today);
    expect(result.date).toBe(today);
  });
});
