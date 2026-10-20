import { monthIndex, previousCompletedMonths, validWindow } from '../window';

describe('completed recurrence UTC months', () => {
  it.each([3, 6, 12] as const)('uses %i completed months, never the current month', months => {
    const now = new Date('2025-01-01T00:00:00Z');
    const window = previousCompletedMonths(months, now)!;
    expect(window.endMonthExclusive).toBe('2025-01');
    expect(monthIndex(window.endMonthExclusive)! - monthIndex(window.startMonth)!).toBe(months);
    expect(validWindow(window, now)).toBe(true);
  });
  it('uses UTC rather than the offset calendar date and handles leap months', () => {
    expect(previousCompletedMonths(3, new Date('2024-03-01T02:30:00+04:00'))).toEqual({
      startMonth: '2023-11', endMonthExclusive: '2024-02',
    });
    expect(previousCompletedMonths(3, new Date('2024-03-01T00:00:00Z'))).toEqual({
      startMonth: '2023-12', endMonthExclusive: '2024-03',
    });
  });
  it('fails closed on invalid dates and representation underflow', () => {
    expect(previousCompletedMonths(3, new Date(NaN))).toBeNull();
    expect(previousCompletedMonths(3, new Date('0001-01-01T00:00:00Z'))).toBeNull();
  });
  it.each(['0000-01', '2025-1', '2025-00', '2025-13', '2025-01\n', ' 2025-01', '10000-01'])('rejects noncanonical month %s', value => {
    expect(monthIndex(value)).toBeNull();
  });
  it.each([
    { startMonth: '2025-01', endMonthExclusive: '2025-01' },
    { startMonth: '2025-02', endMonthExclusive: '2025-01' },
    { startMonth: '2023-12', endMonthExclusive: '2025-01' },
    { startMonth: '2025-01', endMonthExclusive: '2025-03' },
  ])('rejects reversed, oversized and unfinished windows', window => {
    expect(validWindow(window, new Date('2025-02-15T00:00:00Z'))).toBe(false);
  });
});
