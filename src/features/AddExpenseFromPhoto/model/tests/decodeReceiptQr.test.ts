import { BrowserQRCodeReader } from '@zxing/browser';
import { decodeReceiptQr } from '../decodeReceiptQr';

jest.mock('@zxing/browser', () => ({
  BrowserQRCodeReader: jest.fn(),
}));

jest.mock('@zxing/library', () => ({
  BarcodeFormat: { QR_CODE: 'QR_CODE' },
  DecodeHintType: {
    POSSIBLE_FORMATS: 'POSSIBLE_FORMATS',
    TRY_HARDER: 'TRY_HARDER',
  },
}));

const FISCAL_QR = 't=20260828T2046&s=249.99&fn=1&i=2&fp=3&n=1';
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
  let consoleInfo: jest.SpyInstance;
  let canvasContext: Pick<
    CanvasRenderingContext2D,
    'drawImage' | 'getImageData' | 'putImageData' | 'imageSmoothingEnabled'
  >;

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
      naturalWidth = 576;
      naturalHeight = 1280;
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
    getImageData.mockImplementation(() => ({
      data: new Uint8ClampedArray([40, 80, 120, 255]),
    }));
    mockBrowserQRCodeReader.mockImplementation(() => ({
      decodeFromImageUrl,
      decodeFromCanvas,
    }));
    canvasContext = {
      drawImage,
      getImageData,
      putImageData,
      imageSmoothingEnabled: true,
    };
    getContextSpy = jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(canvasContext as CanvasRenderingContext2D);
    consoleInfo = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    getContextSpy.mockRestore();
    consoleInfo.mockRestore();
  });

  afterAll(() => {
    Object.defineProperty(globalThis, 'Image', {
      configurable: true,
      value: originalImage,
    });
  });

  it('uses QR-only TRY_HARDER hints', async () => {
    decodeFromImageUrl.mockResolvedValue({ getText: () => FISCAL_QR });

    await decodeReceiptQr(
      new File(['image'], 'receipt.jpg', { type: 'image/jpeg' }),
    );

    const hints = mockBrowserQRCodeReader.mock.calls[0][0] as Map<
      string,
      unknown
    >;
    expect([...hints.entries()]).toEqual([
      ['POSSIBLE_FORMATS', ['QR_CODE']],
      ['TRY_HARDER', true],
    ]);
  });

  it('stops after the original image succeeds and revokes its URL', async () => {
    decodeFromImageUrl.mockResolvedValue({ getText: () => FISCAL_QR });
    const file = new File(['image'], 'receipt.jpg', { type: 'image/jpeg' });

    await expect(decodeReceiptQr(file)).resolves.toBe(FISCAL_QR);

    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(decodeFromImageUrl).toHaveBeenCalledWith('blob:receipt-image');
    expect(decodeFromCanvas).not.toHaveBeenCalled();
    expect(drawImage).not.toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:receipt-image');
  });

  it('tries the upscaled full-image crop after the original fails', async () => {
    decodeFromImageUrl.mockRejectedValue(new Error('No QR code found'));
    decodeFromCanvas.mockReturnValue({ getText: () => FISCAL_QR });

    await expect(
      decodeReceiptQr(
        new File(['image'], 'receipt.jpg', { type: 'image/jpeg' }),
      ),
    ).resolves.toBe(FISCAL_QR);

    expect(decodeFromCanvas).toHaveBeenCalledTimes(1);
    expect(drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      576,
      1280,
      0,
      0,
      810,
      1800,
    );
    expect(getImageData).not.toHaveBeenCalled();
    expect(canvasContext.imageSmoothingEnabled).toBe(false);
    expect(consoleInfo).toHaveBeenCalledWith('[Receipt QR decode]', {
      attemptType: 'color',
      regionName: 'full',
      canvasWidth: 810,
      canvasHeight: 1800,
      decoded: true,
    });
  });

  it('stops after a later crop succeeds', async () => {
    decodeFromImageUrl.mockRejectedValue(new Error('No QR code found'));
    decodeFromCanvas
      .mockImplementationOnce(() => {
        throw new Error('Color failed');
      })
      .mockImplementationOnce(() => {
        throw new Error('Grayscale failed');
      })
      .mockImplementationOnce(() => {
        throw new Error('Contrast failed');
      })
      .mockImplementationOnce(() => {
        throw new Error('Annotation suppression failed');
      })
      .mockReturnValueOnce({ getText: () => FISCAL_QR });

    await expect(
      decodeReceiptQr(
        new File(['image'], 'receipt.jpg', { type: 'image/jpeg' }),
      ),
    ).resolves.toBe(FISCAL_QR);

    expect(decodeFromCanvas).toHaveBeenCalledTimes(5);
    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(drawImage).toHaveBeenLastCalledWith(
      expect.anything(),
      0,
      384,
      576,
      896,
      0,
      0,
      1157,
      1800,
    );
  });

  it('tries grayscale only after the color variant fails', async () => {
    decodeFromImageUrl.mockRejectedValue(new Error('No QR code found'));
    decodeFromCanvas
      .mockImplementationOnce(() => {
        throw new Error('Color failed');
      })
      .mockReturnValueOnce({ getText: () => FISCAL_QR });

    await decodeReceiptQr(
      new File(['image'], 'receipt.jpg', { type: 'image/jpeg' }),
    );

    expect(decodeFromCanvas).toHaveBeenCalledTimes(2);
    expect(getImageData).toHaveBeenCalledTimes(1);
    expect(putImageData).toHaveBeenCalledTimes(1);
    expect(consoleInfo).toHaveBeenCalledWith(
      '[Receipt QR decode]',
      expect.objectContaining({
        attemptType: 'grayscale',
        regionName: 'full',
        decoded: true,
      }),
    );
  });

  it('tries high contrast only after color and grayscale fail', async () => {
    decodeFromImageUrl.mockRejectedValue(new Error('No QR code found'));
    decodeFromCanvas
      .mockImplementationOnce(() => {
        throw new Error('Color failed');
      })
      .mockImplementationOnce(() => {
        throw new Error('Grayscale failed');
      })
      .mockReturnValueOnce({ getText: () => FISCAL_QR });

    await decodeReceiptQr(
      new File(['image'], 'receipt.jpg', { type: 'image/jpeg' }),
    );

    expect(decodeFromCanvas).toHaveBeenCalledTimes(3);
    expect(putImageData).toHaveBeenCalledTimes(2);
    expect(consoleInfo).toHaveBeenCalledWith(
      '[Receipt QR decode]',
      expect.objectContaining({
        attemptType: 'high-contrast',
        regionName: 'full',
        decoded: true,
      }),
    );
  });

  it('tries annotation suppression only after all normal variants fail', async () => {
    decodeFromImageUrl.mockRejectedValue(new Error('No QR code found'));
    decodeFromCanvas
      .mockImplementationOnce(() => {
        throw new Error('Color failed');
      })
      .mockImplementationOnce(() => {
        throw new Error('Grayscale failed');
      })
      .mockImplementationOnce(() => {
        throw new Error('High contrast failed');
      })
      .mockReturnValueOnce({ getText: () => FISCAL_QR });

    await expect(
      decodeReceiptQr(
        new File(['image'], 'receipt.jpg', { type: 'image/jpeg' }),
      ),
    ).resolves.toBe(FISCAL_QR);

    expect(decodeFromCanvas).toHaveBeenCalledTimes(4);
    expect(getImageData).toHaveBeenCalledTimes(1);
    expect(putImageData).toHaveBeenCalledTimes(3);
    expect(putImageData.mock.calls[2][0].data).toEqual(
      new Uint8ClampedArray([255, 255, 255, 255]),
    );
    expect(consoleInfo).toHaveBeenLastCalledWith(
      '[Receipt QR decode]',
      expect.objectContaining({
        attemptType: 'annotation-suppressed',
        regionName: 'full',
        decoded: true,
      }),
    );
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:receipt-image');
  });

  it('tries all bounded candidates and revokes the URL when none decode', async () => {
    decodeFromImageUrl.mockRejectedValue(new Error('No QR code found'));
    decodeFromCanvas.mockImplementation(() => {
      throw new Error('No QR code found');
    });

    await expect(
      decodeReceiptQr(
        new File(['image'], 'receipt.jpg', { type: 'image/jpeg' }),
      ),
    ).resolves.toBeUndefined();

    expect(drawImage).toHaveBeenCalledTimes(5);
    expect(decodeFromCanvas).toHaveBeenCalledTimes(20);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:receipt-image');
  });
});
