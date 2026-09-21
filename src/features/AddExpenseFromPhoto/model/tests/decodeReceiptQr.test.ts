import { BrowserQRCodeReader } from '@zxing/browser';
import { decodeReceiptQr } from '../decodeReceiptQr';

jest.mock('@zxing/browser', () => ({
  BrowserQRCodeReader: jest.fn(),
}));

const mockBrowserQRCodeReader = BrowserQRCodeReader as unknown as jest.Mock;
const decodeFromImageUrl = jest.fn();

describe('decodeReceiptQr', () => {
  const createObjectURL = jest.fn();
  const revokeObjectURL = jest.fn();

  beforeAll(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    createObjectURL.mockReturnValue('blob:receipt-image');
    mockBrowserQRCodeReader.mockImplementation(() => ({
      decodeFromImageUrl,
    }));
  });

  it('decodes a QR from a local object URL and releases it', async () => {
    decodeFromImageUrl.mockResolvedValue({
      getText: () => 't=20260828T2046&s=249.99&fn=1&i=2&fp=3&n=1',
    });
    const file = new File(['image'], 'receipt.jpg', { type: 'image/jpeg' });

    await expect(decodeReceiptQr(file)).resolves.toBe(
      't=20260828T2046&s=249.99&fn=1&i=2&fp=3&n=1',
    );

    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(decodeFromImageUrl).toHaveBeenCalledWith('blob:receipt-image');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:receipt-image');
  });

  it('returns undefined and releases the URL when no QR is readable', async () => {
    decodeFromImageUrl.mockRejectedValue(new Error('No QR code found'));

    await expect(
      decodeReceiptQr(
        new File(['image'], 'receipt.jpg', { type: 'image/jpeg' }),
      ),
    ).resolves.toBeUndefined();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:receipt-image');
  });
});
