/** Isolated RUB/kopeck policy; not yet applied to existing transaction flows. */
export type MoneyError =
  | 'invalid_amount'
  | 'unsupported_precision'
  | 'unsafe_amount'
  | 'invalid_kopecks'
  | 'overflow';

export type MoneyResult<T = number> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: MoneyError };

const MAX_KOPECKS = BigInt(Number.MAX_SAFE_INTEGER);

const safeKopecks = (value: bigint, error: 'unsafe_amount' | 'overflow'): MoneyResult =>
  value < -MAX_KOPECKS || value > MAX_KOPECKS
    ? { ok: false, error }
    : { ok: true, value: Number(value) };

// Exact decimal output, including negative differences and safe-integer limits.
const decimalRubles = (kopecks: bigint): string => {
  const sign = kopecks < 0n ? '-' : '';
  const absolute = kopecks < 0n ? -kopecks : kopecks;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
};

/**
 * Non-negative recorded RUB -> safe integer kopecks, including zero.
 * Strings: digits with optional dot/comma and 1–2 fraction digits; no whitespace,
 * signs, grouping, exponent notation, or implicit coercion. Leading zeros are OK.
 * Numbers: use the shortest decimal representation, never epsilon/rounding.
 * Numeric exponents work only when their value has a supported representation
 * (1e2, 1e-2); very small fractions and oversized values are rejected.
 * Reject numbers that cannot distinguish adjacent kopecks after conversion back
 * to RUB. Already lost numeric precision cannot be reconstructed by this module.
 */
export const rublesToKopecks = (amount: unknown): MoneyResult => {
  if (typeof amount !== 'string' && typeof amount !== 'number') {
    return { ok: false, error: 'invalid_amount' };
  }
  if (typeof amount === 'number') {
    if (!Number.isFinite(amount) || amount < 0) {
      return { ok: false, error: 'invalid_amount' };
    }
    if (amount > Number.MAX_SAFE_INTEGER / 100) {
      return { ok: false, error: 'unsafe_amount' };
    }
  }

  const decimal = String(amount);
  const match = /^(\d+)(?:[.,](\d+))?$/.exec(decimal);
  if (!match || match[0] !== decimal) {
    return {
      ok: false,
      error: typeof amount === 'number' ? 'unsupported_precision' : 'invalid_amount',
    };
  }
  const fraction = match[2] ?? '';
  if (fraction.length > 2) return { ok: false, error: 'unsupported_precision' };

  const minor = BigInt(match[1]) * 100n + BigInt(fraction.padEnd(2, '0'));
  const result = safeKopecks(minor, 'unsafe_amount');
  if (!result.ok) return result;

  if (typeof amount === 'number' && (
    Number(decimalRubles(minor - 1n)) === amount ||
    Number(decimalRubles(minor + 1n)) === amount
  )) {
    return { ok: false, error: 'unsafe_amount' };
  }
  return result;
};

/** Sum signed safe integer kopecks; empty input is zero. No input mutation.
 * BigInt intermediates make cancellation/order safe; the final result must fit
 * within ±Number.MAX_SAFE_INTEGER. Recorded-amount validation belongs above.
 */
export const sumKopecks = (amounts: readonly number[]): MoneyResult => {
  let total = 0n;
  for (const amount of amounts) {
    if (!Number.isSafeInteger(amount)) return { ok: false, error: 'invalid_kopecks' };
    total += BigInt(amount);
  }
  return safeKopecks(total, 'overflow');
};

/** Signed difference of two safe integer kopeck values, never rounded. */
export const subtractKopecks = (left: number, right: number): MoneyResult => {
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right)) {
    return { ok: false, error: 'invalid_kopecks' };
  }
  return safeKopecks(BigInt(left) - BigInt(right), 'overflow');
};

/** Deterministic display only: e.g. -123 -> "-1,23 ₽"; no locale dependence. */
export const formatKopecks = (kopecks: number): MoneyResult<string> => {
  if (!Number.isSafeInteger(kopecks)) return { ok: false, error: 'invalid_kopecks' };
  return { ok: true, value: `${decimalRubles(BigInt(kopecks)).replace('.', ',')} ₽` };
};
