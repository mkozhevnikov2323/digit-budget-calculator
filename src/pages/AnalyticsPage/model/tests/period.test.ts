import { calendarKeys, currentPeriod, getCalendarRange, getGranularity, parseCalendarDate, shiftPeriod, toApiRange } from '../period';

describe('UTC analytical periods', () => {
  const selection = currentPeriod(new Date('2024-02-29T23:50:00Z'));

  it('includes the full leap-year month', () => {
    expect(getCalendarRange(selection)).toEqual({ start: '2024-02-01', end: '2024-02-29' });
    expect(calendarKeys(getCalendarRange(selection), 'day')).toHaveLength(29);
  });

  it.each([
    [1, '2024-01-01', '2024-03-31'], [3, '2024-01-01', '2024-03-31'],
    [4, '2024-04-01', '2024-06-30'], [7, '2024-07-01', '2024-09-30'],
    [12, '2024-10-01', '2024-12-31'],
  ])('uses calendar quarter containing month %s', (month, start, end) => {
    expect(getCalendarRange({ ...selection, kind: 'quarter', month })).toEqual({ start, end });
  });

  it('uses explicit inclusive endpoints with no next-day leakage', () => {
    const range = toApiRange({ start: '2024-02-28', end: '2024-02-29' });
    expect(range).toEqual({ startDate: '2024-02-28T00:00:00.000Z', endDate: '2024-02-29T23:59:59.999Z' });
    expect(Date.parse(range.endDate) + 1).toBe(Date.parse('2024-03-01T00:00:00Z'));
  });

  it.each(['2023-02-29', '2024-02-30', '2024-13-01', '', '2024-2-1'])('rejects invalid day %s', (date) => {
    expect(() => parseCalendarDate(date)).toThrow();
  });

  it('rejects reversed ranges', () => {
    expect(() => toApiRange({ start: '2024-03-01', end: '2024-02-29' })).toThrow(/позже/);
  });

  it('navigates previous month and quarter across year boundaries', () => {
    const january = { ...selection, month: 1 };
    expect(getCalendarRange(shiftPeriod(january, -1))).toEqual({ start: '2023-12-01', end: '2023-12-31' });
    expect(getCalendarRange(shiftPeriod({ ...january, kind: 'quarter' }, -1))).toEqual({ start: '2023-10-01', end: '2023-12-31' });
    expect(getCalendarRange(shiftPeriod({ ...january, kind: 'year' }, 1))).toEqual({ start: '2025-01-01', end: '2025-12-31' });
  });

  it('orders zero-filled month keys chronologically across multiple years', () => {
    const keys = calendarKeys({ start: '2023-11-14', end: '2025-02-01' }, 'month');
    expect(keys).toHaveLength(16);
    expect(keys.slice(0, 3)).toEqual(['2023-11', '2023-12', '2024-01']);
    expect(keys.slice(-2)).toEqual(['2025-01', '2025-02']);
  });

  it('uses monthly buckets for quarter/year and long custom periods', () => {
    const range = { start: '2024-01-01', end: '2024-01-31' };
    expect(getGranularity(range, 'month')).toBe('day');
    expect(getGranularity(range, 'quarter')).toBe('month');
    expect(getGranularity(range, 'year')).toBe('month');
    expect(getGranularity({ ...range, end: '2024-03-31' }, 'custom')).toBe('month');
    expect(getGranularity({ start: '2024-02-29', end: '2024-03-01' }, 'custom')).toBe('day');
  });

  it('keeps current UTC calendar date even when timestamp has a local offset', () => {
    expect(currentPeriod(new Date('2024-03-01T01:00:00+03:00')).month).toBe(2);
  });
});
