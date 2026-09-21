import type { BrowserQRCodeReader } from '@zxing/browser';
import {
  createHighContrastGrayscalePixels,
  fitImageWithin,
} from './receiptQrImagePreprocessing';

export type ReceiptQrDecoder = (file: File) => Promise<string | undefined>;

let qrReaderPromise: Promise<BrowserQRCodeReader> | undefined;

const getQrReader = () => {
  if (!qrReaderPromise) {
    qrReaderPromise = import('@zxing/browser')
      .then(({ BrowserQRCodeReader }) => new BrowserQRCodeReader())
      .catch((error) => {
        qrReaderPromise = undefined;
        throw error;
      });
  }

  return qrReaderPromise;
};

const getDecodedText = (result: { getText: () => string }) =>
  result.getText().trim() || undefined;

const loadImage = (imageUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error('Receipt image could not be decoded'));
    image.src = imageUrl;
  });

const createResizedCanvas = (image: HTMLImageElement): HTMLCanvasElement => {
  const dimensions = fitImageWithin(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable');

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const enhanceCanvas = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable');

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  imageData.data.set(createHighContrastGrayscalePixels(imageData.data));
  context.putImageData(imageData, 0, 0);
};

const decodeCanvas = (
  reader: BrowserQRCodeReader,
  canvas: HTMLCanvasElement,
): string | undefined => {
  try {
    return getDecodedText(reader.decodeFromCanvas(canvas));
  } catch {
    return undefined;
  }
};

export const decodeReceiptQr: ReceiptQrDecoder = async (file) => {
  const imageUrl = URL.createObjectURL(file);

  try {
    const reader = await getQrReader();

    try {
      const originalResult = await reader.decodeFromImageUrl(imageUrl);
      const originalText = getDecodedText(originalResult);
      if (originalText) return originalText;
    } catch {
      // Continue with bounded local preprocessing attempts.
    }

    const image = await loadImage(imageUrl);
    const resizedCanvas = createResizedCanvas(image);
    const resizedText = decodeCanvas(reader, resizedCanvas);
    if (resizedText) return resizedText;

    enhanceCanvas(resizedCanvas);
    return decodeCanvas(reader, resizedCanvas);
  } catch {
    return undefined;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
};
