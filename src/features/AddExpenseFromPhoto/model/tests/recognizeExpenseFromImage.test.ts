import { decodeReceiptQr } from '../decodeReceiptQr';
import { recognizeLinesWithPaddleOcr } from '../paddleOcrAdapter';
import { parseReceiptLines } from '../parseReceiptLines';
import {
  INVALID_FISCAL_QR_MESSAGE,
  QR_NOT_FOUND_MESSAGE,
  ReceiptQrRecognitionError,
  recognizeExpenseFromImage,
} from '../recognizeExpenseFromImage';

jest.mock('../decodeReceiptQr', () => ({
  decodeReceiptQr: jest.fn(),
}));

jest.mock('../paddleOcrAdapter', () => ({
  recognizeLinesWithPaddleOcr: jest.fn(),
}));

jest.mock('../parseReceiptLines', () => ({
  parseReceiptLines: jest.fn(),
}));

const mockDecodeReceiptQr = decodeReceiptQr as jest.Mock;
const mockRecognizeLinesWithPaddleOcr =
  recognizeLinesWithPaddleOcr as jest.Mock;
const mockParseReceiptLines = parseReceiptLines as jest.Mock;

describe('recognizeExpenseFromImage', () => {
  let consoleInfo: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleInfo = jest
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleInfo.mockRestore();
  });

  it('builds an ExpenseDraft only from a valid fiscal QR', async () => {
    const rawQr =
      't=20260828T2046&s=249.99&fn=9287440300991111&i=109331&fp=1234567890&n=1';
    mockDecodeReceiptQr.mockResolvedValue(rawQr);
    const file = new File(['image'], 'receipt.jpg', { type: 'image/jpeg' });

    await expect(recognizeExpenseFromImage(file)).resolves.toEqual({
      amount: 249.99,
      date: '2026-08-28',
      title: '',
      recipient: '',
      category: '',
      comment: '',
    });

    expect(mockDecodeReceiptQr).toHaveBeenCalledWith(file);
    expect(mockRecognizeLinesWithPaddleOcr).not.toHaveBeenCalled();
    expect(mockParseReceiptLines).not.toHaveBeenCalled();
    expect(consoleInfo).toHaveBeenNthCalledWith(1, '[Receipt QR]', {
      event: 'decode-started',
    });
    expect(consoleInfo).toHaveBeenNthCalledWith(2, '[Receipt QR]', {
      event: 'found',
    });
    expect(consoleInfo).toHaveBeenNthCalledWith(3, '[Receipt QR]', {
      event: 'fiscal-valid',
      date: '2026-08-28',
      amount: 249.99,
    });
    expect(JSON.stringify(consoleInfo.mock.calls)).not.toContain(rawQr);
    expect(JSON.stringify(consoleInfo.mock.calls)).not.toContain(
      '9287440300991111',
    );
    expect(JSON.stringify(consoleInfo.mock.calls)).not.toContain('109331');
    expect(JSON.stringify(consoleInfo.mock.calls)).not.toContain('1234567890');
  });

  it.each([
    ['an unreadable QR', undefined],
    ['a decoder failure', new Error('QR decoder failed')],
  ])('returns a safe recognition error for %s', async (_case, result) => {
    if (result instanceof Error) {
      mockDecodeReceiptQr.mockRejectedValue(result);
    } else {
      mockDecodeReceiptQr.mockResolvedValue(result);
    }

    await expect(
      recognizeExpenseFromImage(
        new File(['image'], 'receipt.jpg', { type: 'image/jpeg' }),
      ),
    ).rejects.toEqual(new ReceiptQrRecognitionError(QR_NOT_FOUND_MESSAGE));

    expect(mockRecognizeLinesWithPaddleOcr).not.toHaveBeenCalled();
    expect(mockParseReceiptLines).not.toHaveBeenCalled();
    expect(consoleInfo).toHaveBeenNthCalledWith(1, '[Receipt QR]', {
      event: 'decode-started',
    });
    expect(consoleInfo).toHaveBeenNthCalledWith(2, '[Receipt QR]', {
      event: 'not-found',
    });
  });

  it('returns a distinct error for a non-fiscal QR', async () => {
    mockDecodeReceiptQr.mockResolvedValue('https://example.com');

    await expect(
      recognizeExpenseFromImage(
        new File(['image'], 'receipt.jpg', { type: 'image/jpeg' }),
      ),
    ).rejects.toEqual(
      new ReceiptQrRecognitionError(INVALID_FISCAL_QR_MESSAGE),
    );

    expect(mockRecognizeLinesWithPaddleOcr).not.toHaveBeenCalled();
    expect(mockParseReceiptLines).not.toHaveBeenCalled();
    expect(consoleInfo).toHaveBeenNthCalledWith(1, '[Receipt QR]', {
      event: 'decode-started',
    });
    expect(consoleInfo).toHaveBeenNthCalledWith(2, '[Receipt QR]', {
      event: 'found',
    });
    expect(consoleInfo).toHaveBeenNthCalledWith(3, '[Receipt QR]', {
      event: 'fiscal-invalid',
    });
  });

  it('rejects a non-image file before QR decoding', async () => {
    const file = new File(['text'], 'receipt.txt', { type: 'text/plain' });

    await expect(recognizeExpenseFromImage(file)).rejects.toThrow(
      'Selected file is not an image',
    );
    expect(mockDecodeReceiptQr).not.toHaveBeenCalled();
    expect(mockRecognizeLinesWithPaddleOcr).not.toHaveBeenCalled();
    expect(mockParseReceiptLines).not.toHaveBeenCalled();
  });
});
