export const QR_DECODE_MAX_DIMENSION = 1600;

export type ImageDimensions = {
  width: number;
  height: number;
};

export const fitImageWithin = (
  width: number,
  height: number,
  maxDimension = QR_DECODE_MAX_DIMENSION,
): ImageDimensions => {
  if (width <= 0 || height <= 0 || maxDimension <= 0) {
    throw new Error('Image dimensions must be positive');
  }

  const scale = Math.min(1, maxDimension / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

export const createHighContrastGrayscalePixels = (
  source: Uint8ClampedArray,
): Uint8ClampedArray => {
  const result = new Uint8ClampedArray(source);

  for (let index = 0; index < result.length; index += 4) {
    const grayscale = Math.round(
      result[index] * 0.299 +
        result[index + 1] * 0.587 +
        result[index + 2] * 0.114,
    );
    const contrasted = Math.max(
      0,
      Math.min(255, Math.round((grayscale - 128) * 1.5 + 128)),
    );

    result[index] = contrasted;
    result[index + 1] = contrasted;
    result[index + 2] = contrasted;
  }

  return result;
};
