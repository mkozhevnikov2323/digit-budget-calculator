/** @jest-environment node */
import {
  customPeriod, monthKeys, monthPeriod, previousMonthPeriod, quarterPeriod, yearPeriod,
  type CalendarPeriod, type PeriodResult,
} from '../period';

const periodValue = (result: PeriodResult): CalendarPeriod => {
  if (!result.ok) throw new Error(`Expected a valid period, got ${result.error}`);
  return result.value;
};

const expectPeriod = (result: PeriodResult, firstDate: string, lastDate: string, exclusiveDate: string) => {
  expect(result).toEqual({
    ok: true,
    value: {
      firstDate,
      lastDate,
      startInclusive: Date.parse(`${firstDate}T00:00:00.000Z`),
      endExclusive: Date.parse(`${exclusiveDate}T00:00:00.000Z`),
    },
  });
};

describe('full calendar selections with UTC boundaries', () => {
  it.each<[number, number, string, string, string]>([
    [2024, 1, '2024-01-01', '2024-01-31', '2024-02-01'],
    [2024, 2, '2024-02-01', '2024-02-29', '2024-03-01'],
    [2025, 2, '2025-02-01', '2025-02-28', '2025-03-01'],
    [2024, 12, '2024-12-01', '2024-12-31', '2025-01-01'],
  ])('returns the full month %i/%i', (year, month, first, last, end) => {
    expectPeriod(monthPeriod(year, month), first, last, end);
  });

  it('finds previous December from January using the supplied reference date', () => {
    expectPeriod(previousMonthPeriod('2025-01-15'), '2024-12-01', '2024-12-31', '2025-01-01');
    expectPeriod(previousMonthPeriod('2024-03-31'), '2024-02-01', '2024-02-29', '2024-03-01');
  });

  it.each<[number, string, string, string]>([
    [1, '2024-01-01', '2024-03-31', '2024-04-01'],
    [2, '2024-04-01', '2024-06-30', '2024-07-01'],
    [3, '2024-07-01', '2024-09-30', '2024-10-01'],
    [4, '2024-10-01', '2024-12-31', '2025-01-01'],
  ])('returns calendar quarter %i', (quarter, first, last, end) => {
    expectPeriod(quarterPeriod(2024, quarter), first, last, end);
  });

  it('returns a full year, including leap day', () => {
    expectPeriod(yearPeriod(2024), '2024-01-01', '2024-12-31', '2025-01-01');
    const period = periodValue(yearPeriod(2024));
    expect(period.endExclusive - period.startInclusive).toBe(366 * 24 * 60 * 60 * 1000);
  });

  it('handles century leap rules without Date rollover', () => {
    expectPeriod(monthPeriod(2000, 2), '2000-02-01', '2000-02-29', '2000-03-01');
    expectPeriod(monthPeriod(1900, 2), '1900-02-01', '1900-02-28', '1900-03-01');
    expect(customPeriod('1900-02-29', '1900-03-01')).toEqual({ ok: false, error: 'invalid_date' });
  });

  it('supports early years without remapping 1–99 into the twentieth century', () => {
    expectPeriod(monthPeriod(1, 1), '0001-01-01', '0001-01-31', '0001-02-01');
    expectPeriod(yearPeriod(99), '0099-01-01', '0099-12-31', '0100-01-01');
    expectPeriod(yearPeriod(1899), '1899-01-01', '1899-12-31', '1900-01-01');
    expect(previousMonthPeriod('0001-01-01')).toEqual({ ok: false, error: 'invalid_year' });
  });

  it('permits an exclusive boundary in year 10000 for a valid selected year 9999', () => {
    const period = periodValue(yearPeriod(9999));
    expect(period.firstDate).toBe('9999-01-01');
    expect(period.lastDate).toBe('9999-12-31');
    expect(new Date(period.endExclusive).toISOString()).toBe('+010000-01-01T00:00:00.000Z');
    expect(monthKeys(period)).toEqual({
      ok: true,
      value: Array.from({ length: 12 }, (_, index) => `9999-${String(index + 1).padStart(2, '0')}`),
    });
  });
});

describe('custom selections and membership at boundaries', () => {
  it('preserves selected inclusive dates for a range within a month', () => {
    expectPeriod(customPeriod('2024-05-10', '2024-05-20'), '2024-05-10', '2024-05-20', '2024-05-21');
  });

  it('handles ranges crossing years', () => {
    expectPeriod(customPeriod('2024-12-20', '2025-01-10'), '2024-12-20', '2025-01-10', '2025-01-11');
  });

  it('includes the full last selected day and excludes the next day', () => {
    const period = periodValue(customPeriod('2024-02-29', '2024-02-29'));
    const inside = (iso: string) => {
      const timestamp = Date.parse(iso);
      return period.startInclusive <= timestamp && timestamp < period.endExclusive;
    };
    expectPeriod({ ok: true, value: period }, '2024-02-29', '2024-02-29', '2024-03-01');
    expect(inside('2024-02-28T23:59:59.999Z')).toBe(false);
    expect(inside('2024-02-29T00:00:00.000Z')).toBe(true);
    expect(inside('2024-02-29T12:00:00.000Z')).toBe(true);
    expect(inside('2024-02-29T23:59:59.999Z')).toBe(true);
    expect(inside('2024-03-01T00:00:00.000Z')).toBe(false);
  });

  it('rejects reversed ranges', () => {
    expect(customPeriod('2025-01-02', '2025-01-01')).toEqual({ ok: false, error: 'invalid_range' });
  });
});

describe('strict validation', () => {
  it.each([
    '2025-02-29', '2024-02-30', '2024-04-31', '2024-00-01', '2024-13-01',
    '2024-01-00', '2024-01-32', '0000-01-01', '10000-01-01', '-001-01-01',
    '2024-1-01', '2024-01-1', '2024/01/01', '2024-01-01T00:00:00Z',
    '2024-01-01Z', ' 2024-01-01', '2024-01-01 ', '2024-01-01\n', '2024-01-01\r', 'not a date', '',
  ])('rejects nonexistent or malformed calendar date %s', (input) => {
    expect(customPeriod(input, '2025-01-01')).toEqual({ ok: false, error: 'invalid_date' });
    expect(customPeriod('2024-01-01', input)).toEqual({ ok: false, error: 'invalid_date' });
    expect(previousMonthPeriod(input)).toEqual({ ok: false, error: 'invalid_date' });
  });

  it.each([0, -1, 10000, 2024.5, NaN, Infinity])('rejects unsupported year %p', (year) => {
    expect(monthPeriod(year, 1)).toEqual({ ok: false, error: 'invalid_year' });
    expect(quarterPeriod(year, 1)).toEqual({ ok: false, error: 'invalid_year' });
    expect(yearPeriod(year)).toEqual({ ok: false, error: 'invalid_year' });
  });

  it.each([0, 13, -1, 1.5, NaN, Infinity])('rejects invalid month %p', (month) => {
    expect(monthPeriod(2024, month)).toEqual({ ok: false, error: 'invalid_month' });
  });

  it.each([0, 5, -1, 1.5, NaN, Infinity])('rejects invalid quarter %p', (quarter) => {
    expect(quarterPeriod(2024, quarter)).toEqual({ ok: false, error: 'invalid_quarter' });
  });
});

describe('complete chronological month sequence', () => {
  it('includes empty months and clipped first/last months without needing transactions', () => {
    const period = periodValue(customPeriod('2024-11-15', '2025-02-02'));
    expect(monthKeys(period)).toEqual({ ok: true, value: ['2024-11', '2024-12', '2025-01', '2025-02'] });
  });

  it('returns just the selected month for one day and never includes the exclusive-end month', () => {
    expect(monthKeys(periodValue(customPeriod('2024-02-29', '2024-02-29'))))
      .toEqual({ ok: true, value: ['2024-02'] });
    expect(monthKeys(periodValue(quarterPeriod(2024, 4))))
      .toEqual({ ok: true, value: ['2024-10', '2024-11', '2024-12'] });
  });

  it('rejects inconsistent caller-supplied boundaries and invalid selected dates', () => {
    const period = periodValue(monthPeriod(2024, 1));
    expect(monthKeys({ ...period, endExclusive: period.endExclusive - 1 }))
      .toEqual({ ok: false, error: 'invalid_range' });
    expect(monthKeys({ ...period, startInclusive: NaN })).toEqual({ ok: false, error: 'invalid_range' });
    expect(monthKeys({ ...period, lastDate: '2024-02-30' })).toEqual({ ok: false, error: 'invalid_date' });
  });

  it('does not mutate the supplied selection and returns independent arrays', () => {
    const period = Object.freeze(periodValue(monthPeriod(2024, 1)));
    const original = { ...period };
    const first = monthKeys(period);
    const second = monthKeys(period);
    expect(first).toEqual({ ok: true, value: ['2024-01'] });
    expect(first).toEqual(second);
    if (!first.ok || !second.ok) throw new Error('Expected valid month sequences');
    expect(first.value).not.toBe(second.value);
    expect(period).toEqual(original);
  });
});

describe('explicit reference dates and UTC-only calendar arithmetic', () => {
  it('does not consult local calendar methods or timezone offsets', () => {
    const methods = [
      'getFullYear', 'getMonth', 'getDate', 'getTimezoneOffset',
      'setFullYear', 'setMonth', 'setDate', 'setHours',
    ] as const;
    const spies = methods.map((method) => jest.spyOn(Date.prototype, method).mockImplementation(() => {
      throw new Error('Host-local calendar access is forbidden');
    }));
    try {
      expectPeriod(monthPeriod(2024, 3), '2024-03-01', '2024-03-31', '2024-04-01');
      expectPeriod(previousMonthPeriod('2025-01-15'), '2024-12-01', '2024-12-31', '2025-01-01');
      const custom = periodValue(customPeriod('2024-03-09', '2024-11-04'));
      expect(monthKeys(custom)).toEqual({
        ok: true, value: ['2024-03', '2024-04', '2024-05', '2024-06', '2024-07', '2024-08', '2024-09', '2024-10', '2024-11'],
      });
    } finally {
      spies.forEach((spy) => spy.mockRestore());
    }
  });

  it('uses the supplied reference date even when the system clock changes', () => {
    jest.useFakeTimers();
    try {
      for (const clock of ['1900-01-01T00:00:00Z', '2040-12-31T23:59:59Z']) {
        jest.setSystemTime(new Date(clock));
        expectPeriod(previousMonthPeriod('2025-01-15'), '2024-12-01', '2024-12-31', '2025-01-01');
      }
    } finally {
      jest.useRealTimers();
    }
  });
});
