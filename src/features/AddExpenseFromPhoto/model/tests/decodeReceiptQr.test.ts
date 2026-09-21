import { BrowserQRCodeReader } from '@zxing/browser';
import { decodeReceiptQr } from '../decodeReceiptQr';

jest.mock('@zxing/browser', () => ({
  BrowserQRCodeReader: jest.fn(),
}));

const mockBrowserQRCodeReader = BrowserQRCodeReader as unknown as jest.Mock;
const decodeFromImageUrl = jest.fn();
const decodeFromCanvas = jest.fn();

describe('decodeReceiptQr', () => {
  const createObjectURL = jest.fn();
  const revokeObjectURL = jest.fn();
  const drawImage = jest.fn();
  const getImageData = jest.fn();
  const putImageData = jest.fn();
  const originalImage = globalThis.Image;
  let getContextSpy: jest.SpyInstance;

  beforeAll(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });
    class MockImage {
      naturalWidth = 3200;
      naturalHeight = 2400;
      onload: (() => void) | null = null;

      set src(_value: string) {
        Promise.resolve().then(() => this.onload?.());
      }
    }
    Object.defineProperty(globalThis, 'Image', {
      configurable: true,
      value: MockImage,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    decodeFromImageUrl.mockReset();
    decodeFromCanvas.mockReset();
    getImageData.mockReset();
    createObjectURL.mockReturnValue('blob:receipt-image');
    getImageData.mockReturnValue({
      data: new Uint8ClampedArray([40, 80, 120, 255]),
    });
    mockBrowserQRCodeReader.mockImplementation(() => ({
      decodeFromImageUrl,
      decodeFromCanvas,
    }));
    getContextSpy = jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({
        drawImage,
        getImageData,
        putImageData,
      } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    getContextSpy.mockRestore();
  });

  afterAll(() => {
    Object.defineProperty(globalThis, 'Image', {
      configurable: true,
      value: originalImage,
    });
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
    expect(decodeFromCanvas).not.toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:receipt-image');
  });

  it('tries a resized canvas after the original image', async () => {
    decodeFromImageUrl.mockRejectedValue(new Error('No QR code found'));
    decodeFromCanvas.mockReturnValue({
      getText: () => 't=20260828T2046&s=249.99&fn=1&i=2&fp=3&n=1',
    });

    await expect(
      decodeReceiptQr(
        new File(['image'], 'receipt.jpg', { type: 'image/jpeg' }),
      ),
    ).resolves.toBe('t=20260828T2046&s=249.99&fn=1&i=2&fp=3&n=1');

    const canvas = decodeFromCanvas.mock.calls[0][0] as HTMLCanvasElement;
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(1200);
    expect(drawImage).toHaveBeenCalled();
    expect(getImageData).not.toHaveBeenCalled();
  });

  it('tries a high-contrast grayscale canvas last', async () => {
    decodeFromImageUrl.mockRejectedValue(new Error('No QR code found'));
    decodeFromCanvas
      .mockImplementationOnce(() => {
        throw new Error('No QR code found');
      })
      .mockReturnValueOnce({
        getText: () => 't=20260828T2046&s=249.99&fn=1&i=2&fp=3&n=1',
      });

    await expect(
      decodeReceiptQr(
        new File(['image'], 'receipt.jpg', { type: 'image/jpeg' }),
      ),
    ).resolves.toBe('t=20260828T2046&s=249.99&fn=1&i=2&fp=3&n=1');

    expect(decodeFromCanvas).toHaveBeenCalledTimes(2);
    expect(getImageData).toHaveBeenCalledTimes(1);
    expect(putImageData).toHaveBeenCalledTimes(1);
  });

  it('returns undefined and releases the URL after all attempts fail', async () => {
    decodeFromImageUrl.mockRejectedValue(new Error('No QR code found'));
    decodeFromCanvas.mockImplementation(() => {
      throw new Error('No QR code found');
    });

    await expect(
      decodeReceiptQr(
        new File(['image'], 'receipt.jpg', { type: 'image/jpeg' }),
      ),
    ).resolves.toBeUndefined();

    expect(decodeFromCanvas).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:receipt-image');
  });
});
