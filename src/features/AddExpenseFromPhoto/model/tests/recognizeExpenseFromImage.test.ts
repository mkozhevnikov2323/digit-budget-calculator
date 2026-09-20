import { recognizeExpenseFromImage } from '../recognizeExpenseFromImage';

describe('recognizeExpenseFromImage', () => {
  it('returns a deterministic local ExpenseDraft for an image', async () => {
    const file = new File(['image'], 'receipt.png', { type: 'image/png' });

    await expect(recognizeExpenseFromImage(file)).resolves.toEqual({
      amount: 123.45,
      date: '2026-09-20',
      title: 'Распознанная покупка',
      recipient: 'Тестовый магазин',
      category: '',
      comment: '',
    });
  });

  it('rejects a non-image file', async () => {
    const file = new File(['text'], 'receipt.txt', { type: 'text/plain' });

    await expect(recognizeExpenseFromImage(file)).rejects.toThrow(
      'Selected file is not an image',
    );
  });
});
