import { recognizeExpenseFromImage } from '../recognizeExpenseFromImage';
import { decodeReceiptQr } from '../decodeReceiptQr';
import { recognizeLinesWithPaddleOcr } from '../paddleOcrAdapter';

jest.mock('../decodeReceiptQr', () => ({
  decodeReceiptQr: jest.fn(),
}));

jest.mock('../paddleOcrAdapter', () => ({
  recognizeLinesWithPaddleOcr: jest.fn(),
}));

const mockRecognizeLinesWithPaddleOcr =
  recognizeLinesWithPaddleOcr as jest.Mock;
const mockDecodeReceiptQr = decodeReceiptQr as jest.Mock;

describe('recognizeExpenseFromImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDecodeReceiptQr.mockResolvedValue(undefined);
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

  it('falls back to PaddleOCR when QR decoding fails', async () => {
    mockDecodeReceiptQr.mockRejectedValue(new Error('No QR code found'));
    mockRecognizeLinesWithPaddleOcr.mockResolvedValue([
      { text: 'Дата 23.08.26', score: 0.99 },
      { text: 'ИТОГ 321,50', score: 0.99 },
    ]);

    await expect(
      recognizeExpenseFromImage(
        new File(['image'], 'receipt.jpg', { type: 'image/jpeg' }),
      ),
    ).resolves.toEqual(
      expect.objectContaining({ amount: 321.5, date: '2026-08-23' }),
    );
  });

  it('keeps valid fiscal QR fields when optional OCR enrichment fails', async () => {
    mockDecodeReceiptQr.mockResolvedValue(
      't=20260828T2046&s=249.99&fn=9287440300991111&i=109331&fp=1234567890&n=1',
    );
    mockRecognizeLinesWithPaddleOcr.mockRejectedValue(
      new Error('OCR initialization failed'),
    );

    await expect(
      recognizeExpenseFromImage(
        new File(['image'], 'receipt.jpg', { type: 'image/jpeg' }),
      ),
    ).resolves.toEqual({
      amount: 249.99,
      date: '2026-08-28',
      title: '',
      recipient: undefined,
      category: '',
      comment: '',
    });
  });

  it('prefers fiscal QR amount and date while keeping OCR recipient', async () => {
    mockDecodeReceiptQr.mockResolvedValue(
      't=20260828T2046&s=249.99&fn=9287440300991111&i=109331&fp=1234567890&n=1',
    );
    mockRecognizeLinesWithPaddleOcr.mockResolvedValue([
      { text: 'МАГАЗИН У ДОМА', score: 0.99 },
      { text: 'Дата 20.09.2025', score: 0.99 },
      { text: 'ИТОГ 999,99', score: 0.99 },
    ]);

    await expect(
      recognizeExpenseFromImage(
        new File(['image'], 'receipt.jpg', { type: 'image/jpeg' }),
      ),
    ).resolves.toEqual({
      amount: 249.99,
      date: '2026-08-28',
      title: '',
      recipient: 'МАГАЗИН У ДОМА',
      category: '',
      comment: '',
    });
  });

  it('ignores a non-fiscal QR and uses OCR values', async () => {
    mockDecodeReceiptQr.mockResolvedValue('https://example.com');
    mockRecognizeLinesWithPaddleOcr.mockResolvedValue([
      { text: 'Дата 29.08.26', score: 0.99 },
      { text: 'К ОПЛАТЕ 500,00', score: 0.99 },
    ]);

    await expect(
      recognizeExpenseFromImage(
        new File(['image'], 'receipt.jpg', { type: 'image/jpeg' }),
      ),
    ).resolves.toEqual(
      expect.objectContaining({ amount: 500, date: '2026-08-29' }),
    );
  });

  it('rejects a non-image file', async () => {
    const file = new File(['text'], 'receipt.txt', { type: 'text/plain' });

    await expect(recognizeExpenseFromImage(file)).rejects.toThrow(
      'Selected file is not an image',
    );
    expect(mockRecognizeLinesWithPaddleOcr).not.toHaveBeenCalled();
    expect(mockDecodeReceiptQr).not.toHaveBeenCalled();
  });
});
