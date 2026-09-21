import type { BrowserQRCodeReader } from '@zxing/browser';
import type { BarcodeFormat, DecodeHintType } from '@zxing/library';
import {
  createGrayscalePixels,
  createHighContrastGrayscalePixels,
  createReceiptQrCropRegions,
  scaleCropDimensions,
  type ReceiptQrCropRegion,
} from './receiptQrImagePreprocessing';

export type ReceiptQrDecoder = (file: File) => Promise<string | undefined>;

type DecodeAttemptType =
  | 'original'
  | 'color'
  | 'grayscale'
  | 'high-contrast';

let qrReaderPromise: Promise<BrowserQRCodeReader> | undefined;

const getQrReader = () => {
  if (!qrReaderPromise) {
    qrReaderPromise = Promise.all([
      import('@zxing/browser'),
      import('@zxing/library'),
    ])
      .then(
        ([{ BrowserQRCodeReader }, { BarcodeFormat, DecodeHintType }]) => {
          const hints = new Map<
            DecodeHintType,
            BarcodeFormat[] | boolean
          >();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.QR_CODE,
          ]);
          hints.set(DecodeHintType.TRY_HARDER, true);

          return new BrowserQRCodeReader(hints);
        },
      )
      .catch((error) => {
        qrReaderPromise = undefined;
        throw error;
      });
  }

  return qrReaderPromise;
};

const logDecodeAttempt = (
  attemptType: DecodeAttemptType,
  regionName: 'original' | ReceiptQrCropRegion['name'],
  decoded: boolean,
  canvas?: HTMLCanvasElement,
) => {
  if (process.env.NODE_ENV === 'production') return;

  console.info('[Receipt QR decode]', {
    attemptType,
    regionName,
    ...(canvas && {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
    }),
    decoded,
  });
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

const createCropCanvas = (
  image: HTMLImageElement,
  region: ReceiptQrCropRegion,
): HTMLCanvasElement => {
  const dimensions = scaleCropDimensions(region.width, region.height);
  const canvas = document.createElement('canvas');
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable');

  context.drawImage(
    image,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
};

const decodeCanvasVariant = (
  reader: BrowserQRCodeReader,
  canvas: HTMLCanvasElement,
  region: ReceiptQrCropRegion,
  attemptType: Exclude<DecodeAttemptType, 'original'>,
): string | undefined => {
  let decodedText: string | undefined;

  try {
    decodedText = getDecodedText(reader.decodeFromCanvas(canvas));
  } catch {
    decodedText = undefined;
  }

  logDecodeAttempt(attemptType, region.name, Boolean(decodedText), canvas);
  return decodedText;
};

const decodeCrop = (
  reader: BrowserQRCodeReader,
  image: HTMLImageElement,
  region: ReceiptQrCropRegion,
): string | undefined => {
  const canvas = createCropCanvas(image, region);
  const colorText = decodeCanvasVariant(reader, canvas, region, 'color');
  if (colorText) return colorText;

  const context = canvas.getContext('2d');
  if (!context) return undefined;

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const originalPixels = new Uint8ClampedArray(imageData.data);

  imageData.data.set(createGrayscalePixels(originalPixels));
  context.putImageData(imageData, 0, 0);
  const grayscaleText = decodeCanvasVariant(
    reader,
    canvas,
    region,
    'grayscale',
  );
  if (grayscaleText) return grayscaleText;

  imageData.data.set(createHighContrastGrayscalePixels(originalPixels));
  context.putImageData(imageData, 0, 0);
  return decodeCanvasVariant(reader, canvas, region, 'high-contrast');
};

export const decodeReceiptQr: ReceiptQrDecoder = async (file) => {
  const imageUrl = URL.createObjectURL(file);

  try {
    const reader = await getQrReader();
    let originalText: string | undefined;

    try {
      originalText = getDecodedText(await reader.decodeFromImageUrl(imageUrl));
    } catch {
      originalText = undefined;
    }

    logDecodeAttempt('original', 'original', Boolean(originalText));
    if (originalText) return originalText;

    const image = await loadImage(imageUrl);
    const regions = createReceiptQrCropRegions(
      image.naturalWidth,
      image.naturalHeight,
    );

    for (const region of regions) {
      try {
        const decodedText = decodeCrop(reader, image, region);
        if (decodedText) return decodedText;
      } catch {
        // Continue with the next bounded crop candidate.
      }
    }

    return undefined;
  } catch {
    return undefined;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
};
