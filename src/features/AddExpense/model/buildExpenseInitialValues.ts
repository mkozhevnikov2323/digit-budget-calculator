import { getTodayDateString } from 'shared/lib/utils/date';
import type { ExpenseDraft, ExpenseFormValues } from './types';

const isValidDateString = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === value
  );
};

const normalizeText = (value: unknown): string =>
  typeof value === 'string' ? value : '';

export const buildExpenseInitialValues = (
  draft?: ExpenseDraft,
): ExpenseFormValues => {
  const amount = draft?.amount;

  return {
    amount:
      typeof amount === 'number' && Number.isFinite(amount) && amount >= 0
        ? amount
        : 0,
    date: isValidDateString(draft?.date)
      ? draft.date
      : getTodayDateString(),
    title: normalizeText(draft?.title),
    category: normalizeText(draft?.category),
    recipient: normalizeText(draft?.recipient),
    comment: normalizeText(draft?.comment),
  };
};
