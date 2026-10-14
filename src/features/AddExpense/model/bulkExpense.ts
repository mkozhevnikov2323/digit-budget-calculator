export const MAX_BATCH_SIZE = 30;

export type ExpensePosition = {
  title: string;
  category: string;
  unitPrice: string;
  quantity: number;
  comment: string;
};

export type BulkExpenseValues = {
  date: string;
  recipient: string;
  positions: ExpensePosition[];
};

export const createEmptyPosition = (): ExpensePosition => ({
  title: '', category: '', unitPrice: '', quantity: 1, comment: '',
});

// Parse decimal money without multiplying a floating-point price by 100.
export const priceToKopecks = (price: string): number | null => {
  const normalized = String(price).trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [rubles, fraction = ''] = normalized.split('.');
  const kopecks = Number(rubles) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(kopecks) && kopecks > 0 &&
    kopecks <= Math.floor(Number.MAX_SAFE_INTEGER / MAX_BATCH_SIZE)
    ? kopecks : null;
};

export const isValidQuantity = (quantity: number) =>
  Number.isSafeInteger(quantity) && quantity >= 1;

export const formatKopecks = (kopecks: number) =>
  `${Math.floor(kopecks / 100)},${String(kopecks % 100).padStart(2, '0')} ₽`;
