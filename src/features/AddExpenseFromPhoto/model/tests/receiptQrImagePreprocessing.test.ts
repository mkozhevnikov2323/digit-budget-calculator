import {
  createHighContrastGrayscalePixels,
  fitImageWithin,
} from '../receiptQrImagePreprocessing';

describe('receiptQrImagePreprocessing', () => {
  it('resizes a large image while preserving its aspect ratio', () => {
    expect(fitImageWithin(4000, 3000)).toEqual({
      width: 1600,
      height: 1200,
    });
    expect(fitImageWithin(2000, 4000)).toEqual({
      width: 800,
      height: 1600,
    });
  });

  it('does not upscale a small image', () => {
    expect(fitImageWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('creates a grayscale high-contrast copy without mutating the source', () => {
    const source = new Uint8ClampedArray([
      255, 0, 0, 255, 128, 128, 128, 200, 255, 255, 255, 100,
    ]);
    const before = new Uint8ClampedArray(source);

    const result = createHighContrastGrayscalePixels(source);

    expect(result).toEqual(
      new Uint8ClampedArray([
        50, 50, 50, 255, 128, 128, 128, 200, 255, 255, 255, 100,
      ]),
    );
    expect(source).toEqual(before);
    expect(result).not.toBe(source);
  });
});
