import { calendarKeys, parseCalendarDate, toApiRange, type CalendarRange } from './period';

type Transaction = { _id: string; amount: number; date: string };
type Expense = Transaction & { category?: string };
export type CategoryTotal = { category: string; kopecks: number; count: number; share: number };
export type Analytics = {
  incomeKopecks: number; expenseKopecks: number; differenceKopecks: number;
  incomeCount: number; expenseCount: number;
  categories: CategoryTotal[];
  dynamics: { key: string; kopecks: number }[];
};

// Round decimal representation of the persisted Number half-up to kopecks.
// BigInt avoids both binary decimal rounding errors and silent overflow.
export const moneyToKopecks = (amount: number): number => {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
    throw new Error('Некорректная денежная сумма в данных операций.');
  }
  const [mantissa, exponent = '0'] = amount.toString().split('e');
  const [whole, fraction = ''] = mantissa.split('.');
  const digits = BigInt(whole + fraction);
  const scale = 2 + Number(exponent) - fraction.length;
  const powerOfTen = (power: number) => BigInt(`1${'0'.repeat(power)}`);
  const divisor = scale < 0 ? powerOfTen(-scale) : 1n;
  const kopecks = scale >= 0 ? digits * powerOfTen(scale) : (digits + divisor / 2n) / divisor;
  if (kopecks > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Переполнение денежной суммы.');
  return Number(kopecks);
};

export const addKopecks = (left: number, right: number): number => {
  const sum = left + right;
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right) || !Number.isSafeInteger(sum)) {
    throw new Error('Переполнение денежного итога.');
  }
  return sum;
};

export const formatMoney = (kopecks: number): string => {
  if (!Number.isSafeInteger(kopecks)) throw new Error('Некорректный денежный итог.');
  const absolute = Math.abs(kopecks);
  const rubles = Math.floor(absolute / 100).toLocaleString('ru-RU');
  return `${kopecks < 0 ? '−' : ''}${rubles},${String(absolute % 100).padStart(2, '0')} ₽`;
};

export const assertCompleteResponse = (
  response: { total: number; page: number; limit: number }, records: unknown,
): void => {
  if (!Array.isArray(records) || !Number.isSafeInteger(response.total) || response.total < 0 ||
      response.total !== records.length || response.page !== 1 || !Number.isSafeInteger(response.limit) || response.limit < records.length) {
    throw new Error('Получен неполный или некорректный ответ API. Итоги не рассчитаны.');
  }
};

export const buildAnalytics = (
  expenses: Expense[], incomes: Transaction[], range: CalendarRange, granularity: 'day' | 'month',
): Analytics => {
  const apiRange = toApiRange(range);
  const start = Date.parse(apiRange.startDate);
  const end = Date.parse(apiRange.endDate);
  const validate = (records: Transaction[]) => {
    const ids = new Set<string>();
    for (const record of records) {
      if (!record || typeof record._id !== 'string' || !record._id || ids.has(record._id)) {
        throw new Error('Некорректные или повторяющиеся идентификаторы операций.');
      }
      ids.add(record._id);
      if (typeof record.date !== 'string') throw new Error('Некорректная дата операции.');
      parseCalendarDate(record.date.slice(0, 10));
      const timestamp = Date.parse(record.date);
      if (!Number.isFinite(timestamp) || timestamp < start || timestamp > end) {
        throw new Error('Дата операции не соответствует выбранному периоду.');
      }
    }
  };
  validate(expenses);
  validate(incomes);
  const categories = new Map<string, CategoryTotal>();
  const dynamics = new Map(calendarKeys(range, granularity).map((key) => [key, 0]));
  let expenseKopecks = 0;
  for (const expense of expenses) {
    const kopecks = moneyToKopecks(expense.amount);
    expenseKopecks = addKopecks(expenseKopecks, kopecks);
    if (expense.category != null && typeof expense.category !== 'string') throw new Error('Некорректная категория операции.');
    const name = expense.category?.trim() || 'Без категории';
    const group = categories.get(name) ?? { category: name, kopecks: 0, count: 0, share: 0 };
    group.kopecks = addKopecks(group.kopecks, kopecks);
    group.count += 1;
    categories.set(name, group);
    const key = new Date(expense.date).toISOString().slice(0, granularity === 'month' ? 7 : 10);
    dynamics.set(key, addKopecks(dynamics.get(key) ?? 0, kopecks));
  }
  const incomeKopecks = incomes.reduce((sum, income) => addKopecks(sum, moneyToKopecks(income.amount)), 0);
  return {
    incomeKopecks, expenseKopecks, differenceKopecks: addKopecks(incomeKopecks, -expenseKopecks),
    incomeCount: incomes.length, expenseCount: expenses.length,
    categories: [...categories.values()].map((category) => ({ ...category, share: expenseKopecks ? category.kopecks / expenseKopecks * 100 : 0 }))
      .sort((a, b) => b.kopecks - a.kopecks || a.category.localeCompare(b.category, 'ru')),
    dynamics: [...dynamics].map(([key, kopecks]) => ({ key, kopecks })),
  };
};
