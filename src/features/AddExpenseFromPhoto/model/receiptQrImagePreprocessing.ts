export const QR_CROP_MAX_DIMENSION = 1800;
export const QR_CROP_MAX_SCALE = 3;

export type ImageDimensions = {
  width: number;
  height: number;
};

export type ReceiptQrCropRegionName =
  | 'full'
  | 'lower-70'
  | 'lower-left'
  | 'lower-right'
  | 'lower-center';

export type ReceiptQrCropRegion = ImageDimensions & {
  name: ReceiptQrCropRegionName;
  x: number;
  y: number;
};

type RelativeCropRegion = {
  name: ReceiptQrCropRegionName;
  x: number;
  y: number;
  width: number;
  height: number;
};

const relativeCropRegions: readonly RelativeCropRegion[] = [
  { name: 'full', x: 0, y: 0, width: 1, height: 1 },
  { name: 'lower-70', x: 0, y: 0.3, width: 1, height: 0.7 },
  { name: 'lower-left', x: 0, y: 0.4, width: 0.72, height: 0.6 },
  { name: 'lower-right', x: 0.28, y: 0.4, width: 0.72, height: 0.6 },
  { name: 'lower-center', x: 0.12, y: 0.35, width: 0.76, height: 0.65 },
];

const validateDimensions = (width: number, height: number) => {
  if (width <= 0 || height <= 0) {
    throw new Error('Image dimensions must be positive');
  }
};

export const createReceiptQrCropRegions = (
  imageWidth: number,
  imageHeight: number,
): ReceiptQrCropRegion[] => {
  validateDimensions(imageWidth, imageHeight);

  return relativeCropRegions.map((region) => {
    const x = Math.round(imageWidth * region.x);
    const y = Math.round(imageHeight * region.y);

    return {
      name: region.name,
      x,
      y,
      width: Math.min(imageWidth - x, Math.round(imageWidth * region.width)),
      height: Math.min(
        imageHeight - y,
        Math.round(imageHeight * region.height),
      ),
    };
  });
};

export const scaleCropDimensions = (
  width: number,
  height: number,
  maxDimension = QR_CROP_MAX_DIMENSION,
  maxScale = QR_CROP_MAX_SCALE,
): ImageDimensions => {
  validateDimensions(width, height);
  if (maxDimension <= 0 || maxScale <= 0) {
    throw new Error('Scale limits must be positive');
  }

  const scale = Math.min(maxScale, maxDimension / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const transformToGrayscale = (
  source: Uint8ClampedArray,
  contrast: number,
): Uint8ClampedArray => {
  const result = new Uint8ClampedArray(source);

  for (let index = 0; index < result.length; index += 4) {
    const grayscale = Math.round(
      result[index] * 0.299 +
        result[index + 1] * 0.587 +
        result[index + 2] * 0.114,
    );
    const adjusted = Math.max(
      0,
      Math.min(255, Math.round((grayscale - 128) * contrast + 128)),
    );

    result[index] = adjusted;
    result[index + 1] = adjusted;
    result[index + 2] = adjusted;
  }

  return result;
};

export const createGrayscalePixels = (
  source: Uint8ClampedArray,
): Uint8ClampedArray => transformToGrayscale(source, 1);

export const createHighContrastGrayscalePixels = (
  source: Uint8ClampedArray,
): Uint8ClampedArray => transformToGrayscale(source, 1.5);

const COLORED_PIXEL_MIN_CHANNEL_DIFFERENCE = 40;
const COLORED_PIXEL_MIN_SATURATION = 0.25;

export const removeColoredAnnotations = (
  source: Uint8ClampedArray,
): Uint8ClampedArray => {
  const result = new Uint8ClampedArray(source);

  for (let index = 0; index < result.length; index += 4) {
    const red = result[index];
    const green = result[index + 1];
    const blue = result[index + 2];
    const maximumChannel = Math.max(red, green, blue);
    const minimumChannel = Math.min(red, green, blue);
    const channelDifference = maximumChannel - minimumChannel;
    const saturation =
      maximumChannel === 0 ? 0 : channelDifference / maximumChannel;

    if (
      channelDifference >= COLORED_PIXEL_MIN_CHANNEL_DIFFERENCE &&
      saturation >= COLORED_PIXEL_MIN_SATURATION
    ) {
      result[index] = 255;
      result[index + 1] = 255;
      result[index + 2] = 255;
    }
  }

  return result;
};
