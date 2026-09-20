import type { ExpenseDraft } from 'features/AddExpense';

export const recognizeExpenseFromImage = async (
  file: File,
): Promise<ExpenseDraft> => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selected file is not an image');
  }

  await Promise.resolve();

  return {
    amount: 123.45,
    date: '2026-09-20',
    title: 'Распознанная покупка',
    recipient: 'Тестовый магазин',
    category: '',
    comment: '',
  };
};
