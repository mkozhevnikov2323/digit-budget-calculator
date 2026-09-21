import { recognizeExpenseFromImage } from '../recognizeExpenseFromImage';
import { recognizeLinesWithPaddleOcr } from '../paddleOcrAdapter';

jest.mock('../paddleOcrAdapter', () => ({
  recognizeLinesWithPaddleOcr: jest.fn(),
}));

const mockRecognizeLinesWithPaddleOcr =
  recognizeLinesWithPaddleOcr as jest.Mock;

describe('recognizeExpenseFromImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('parses PaddleOCR lines into an ExpenseDraft', async () => {
    mockRecognizeLinesWithPaddleOcr.mockResolvedValue([
      { text: 'ООО "Ромашка"', score: 0.99 },
      { text: 'Дата 20.09.2026', score: 0.98 },
      { text: 'К ОПЛАТЕ 123,45', score: 0.97 },
    ]);
    const file = new File(['image'], 'receipt.png', { type: 'image/png' });

    await expect(recognizeExpenseFromImage(file)).resolves.toEqual({
      amount: 123.45,
      date: '2026-09-20',
      title: '',
      recipient: 'ООО "Ромашка"',
      category: '',
      comment: '',
    });
    expect(mockRecognizeLinesWithPaddleOcr).toHaveBeenCalledWith(file);
  });

  it('rejects a non-image file', async () => {
    const file = new File(['text'], 'receipt.txt', { type: 'text/plain' });

    await expect(recognizeExpenseFromImage(file)).rejects.toThrow(
      'Selected file is not an image',
    );
    expect(mockRecognizeLinesWithPaddleOcr).not.toHaveBeenCalled();
  });
});
