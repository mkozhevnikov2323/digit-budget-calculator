/** @jest-environment node */
import { formatKopecks, rublesToKopecks, subtractKopecks, sumKopecks } from '../money';

describe('recorded RUB to integer kopecks', () => {
  it.each<[unknown, number]>([
    [0, 0], [-0, 0], ['0', 0], ['0.00', 0], ['0,00', 0],
    [0.01, 1], [0.1, 10], [0.29, 29], [123.45, 12345],
    ['123.45', 12345], ['123,45', 12345], ['001.2', 120],
  ])('converts %p without rounding or rejecting ordinary decimals', (input, expected) => {
    expect(rublesToKopecks(input)).toEqual({ ok: true, value: expected });
  });

  it('adds 0.10 and 0.20 as exactly 30 kopecks', () => {
    const first = rublesToKopecks('0.10');
    const second = rublesToKopecks(0.20);
    if (!first.ok || !second.ok) throw new Error('Expected valid decimal inputs');
    const total = sumKopecks([first.value, second.value]);
    expect(total).toEqual({ ok: true, value: 30 });
    if (!total.ok) throw new Error('Expected a valid sum');
    expect(formatKopecks(total.value)).toEqual({ ok: true, value: '0,30 ₽' });
  });

  it.each([1.005, '1.005', '1,005', '1.000', 0.1 + 0.2])(
    'rejects unsupported precision %p instead of silently rounding', (input) => {
      expect(rublesToKopecks(input)).toEqual({ ok: false, error: 'unsupported_precision' });
    },
  );

  it.each<[unknown]>([
    -1, -0.01, '-1', '-0', NaN, Infinity, -Infinity, null, undefined, true,
    '', ' ', ' 1.00', '1.00 ', '1.00\n', '1.00\r', 'text', 'NaN', 'Infinity', '+1', '.5', '1.',
    '1,', '1.2.3', '1,2.3', '1 000', '1_000', '0x10', '1 ₽', {}, [],
  ].map((input): [unknown] => [input]))('rejects malformed, missing, negative or non-finite input %p', (input) => {
    expect(rublesToKopecks(input)).toEqual({ ok: false, error: 'invalid_amount' });
  });

  it.each(['1e2', '1e-2', '1E+3'])('rejects exponent strings %s under the strict grammar', (input) => {
    expect(rublesToKopecks(input)).toEqual({ ok: false, error: 'invalid_amount' });
  });

  it('accepts numeric exponent values only when the represented decimal is supported', () => {
    expect(rublesToKopecks(1e2)).toEqual({ ok: true, value: 10000 });
    expect(rublesToKopecks(1e-2)).toEqual({ ok: true, value: 1 });
    expect(rublesToKopecks(1e-3)).toEqual({ ok: false, error: 'unsupported_precision' });
    expect(rublesToKopecks(1e-7)).toEqual({ ok: false, error: 'unsupported_precision' });
    expect(rublesToKopecks(1e21)).toEqual({ ok: false, error: 'unsafe_amount' });
  });

  it('accepts the exact safe-integer limit from a decimal string and rejects the next kopeck', () => {
    expect(rublesToKopecks('90071992547409.91')).toEqual({ ok: true, value: Number.MAX_SAFE_INTEGER });
    expect(rublesToKopecks('90071992547409.92')).toEqual({ ok: false, error: 'unsafe_amount' });
    expect(rublesToKopecks('900719925474099200000')).toEqual({ ok: false, error: 'unsafe_amount' });
  });

  it('rejects unsafe numeric conversion, including numbers that merge adjacent kopecks', () => {
    expect(rublesToKopecks(Number.MAX_SAFE_INTEGER)).toEqual({ ok: false, error: 'unsafe_amount' });
    expect(rublesToKopecks(Number.MAX_SAFE_INTEGER + 1)).toEqual({ ok: false, error: 'unsafe_amount' });
    expect(rublesToKopecks(Number('90071992547409.91'))).toEqual({ ok: false, error: 'unsafe_amount' });
  });

  it('distinguishes a valid zero from invalid input', () => {
    expect(rublesToKopecks(0)).toEqual({ ok: true, value: 0 });
    expect(rublesToKopecks(null).ok).toBe(false);
    expect(rublesToKopecks('').ok).toBe(false);
  });
});

describe('safe integer kopeck arithmetic', () => {
  it('supports empty totals and negative income-minus-expense differences', () => {
    expect(sumKopecks([])).toEqual({ ok: true, value: 0 });
    expect(subtractKopecks(100, 250)).toEqual({ ok: true, value: -150 });
    expect(sumKopecks([100, -250])).toEqual({ ok: true, value: -150 });
    expect(subtractKopecks(0, 0)).toEqual({ ok: true, value: 0 });
  });

  it.each([0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid minor-unit operands %p before calculating', (input) => {
      expect(sumKopecks([input])).toEqual({ ok: false, error: 'invalid_kopecks' });
      expect(subtractKopecks(input, 0)).toEqual({ ok: false, error: 'invalid_kopecks' });
      expect(subtractKopecks(0, input)).toEqual({ ok: false, error: 'invalid_kopecks' });
    },
  );

  it('handles both safe-integer boundaries exactly', () => {
    const max = Number.MAX_SAFE_INTEGER;
    expect(sumKopecks([max - 1, 1])).toEqual({ ok: true, value: max });
    expect(sumKopecks([-max + 1, -1])).toEqual({ ok: true, value: -max });
    expect(subtractKopecks(max, max)).toEqual({ ok: true, value: 0 });
    expect(subtractKopecks(0, max)).toEqual({ ok: true, value: -max });
  });

  it('rejects aggregation and subtraction overflow in both directions', () => {
    const max = Number.MAX_SAFE_INTEGER;
    expect(sumKopecks([max, 1])).toEqual({ ok: false, error: 'overflow' });
    expect(sumKopecks([-max, -1])).toEqual({ ok: false, error: 'overflow' });
    expect(subtractKopecks(max, -1)).toEqual({ ok: false, error: 'overflow' });
    expect(subtractKopecks(-max, 1)).toEqual({ ok: false, error: 'overflow' });
  });

  it('preserves cancellation without intermediate precision loss or order dependence', () => {
    const max = Number.MAX_SAFE_INTEGER;
    expect(sumKopecks([max, 1, -max])).toEqual({ ok: true, value: 1 });
    expect(sumKopecks([max, -max, 1])).toEqual({ ok: true, value: 1 });
    expect(sumKopecks([max, max, -max])).toEqual({ ok: true, value: max });
  });

  it('does not mutate caller-owned amounts', () => {
    const amounts = Object.freeze([10, 20, 29]);
    expect(sumKopecks(amounts)).toEqual({ ok: true, value: 59 });
    expect(amounts).toEqual([10, 20, 29]);
  });
});

describe('display formatting is separate from arithmetic', () => {
  it.each<[number, string]>([
    [0, '0,00 ₽'], [-0, '0,00 ₽'], [1, '0,01 ₽'], [29, '0,29 ₽'],
    [12345, '123,45 ₽'], [-1, '-0,01 ₽'], [-12345, '-123,45 ₽'],
    [Number.MAX_SAFE_INTEGER, '90071992547409,91 ₽'],
    [-Number.MAX_SAFE_INTEGER, '-90071992547409,91 ₽'],
  ])('formats %p exactly without floating-point division', (input, expected) => {
    expect(formatKopecks(input)).toEqual({ ok: true, value: expected });
  });

  it.each([1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('does not truncate invalid kopecks %p', (input) => {
    expect(formatKopecks(input)).toEqual({ ok: false, error: 'invalid_kopecks' });
  });
});
