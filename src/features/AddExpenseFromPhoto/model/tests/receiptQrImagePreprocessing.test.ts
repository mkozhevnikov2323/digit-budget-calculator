import {
  createGrayscalePixels,
  createHighContrastGrayscalePixels,
  createReceiptQrCropRegions,
  scaleCropDimensions,
} from '../receiptQrImagePreprocessing';

describe('receiptQrImagePreprocessing', () => {
  it('creates five overlapping deterministic crop regions', () => {
    expect(createReceiptQrCropRegions(576, 1280)).toEqual([
      { name: 'full', x: 0, y: 0, width: 576, height: 1280 },
      { name: 'lower-70', x: 0, y: 384, width: 576, height: 896 },
      { name: 'lower-left', x: 0, y: 512, width: 415, height: 768 },
      { name: 'lower-right', x: 161, y: 512, width: 415, height: 768 },
      { name: 'lower-center', x: 69, y: 448, width: 438, height: 832 },
    ]);
  });

  it('upscales crop candidates while preserving aspect ratio', () => {
    expect(scaleCropDimensions(576, 1280)).toEqual({
      width: 810,
      height: 1800,
    });
    expect(scaleCropDimensions(415, 768)).toEqual({
      width: 973,
      height: 1800,
    });

    const sourceRatio = 415 / 768;
    const scaled = scaleCropDimensions(415, 768);
    expect(scaled.width / scaled.height).toBeCloseTo(sourceRatio, 3);
  });

  it('caps both downscaling and upscaling', () => {
    expect(scaleCropDimensions(4000, 3000)).toEqual({
      width: 1800,
      height: 1350,
    });
    expect(scaleCropDimensions(200, 100)).toEqual({
      width: 600,
      height: 300,
    });
  });

  it('creates grayscale variants without mutating the source', () => {
    const source = new Uint8ClampedArray([255, 0, 0, 255]);
    const before = new Uint8ClampedArray(source);

    expect(createGrayscalePixels(source)).toEqual(
      new Uint8ClampedArray([76, 76, 76, 255]),
    );
    expect(createHighContrastGrayscalePixels(source)).toEqual(
      new Uint8ClampedArray([50, 50, 50, 255]),
    );
    expect(source).toEqual(before);
  });
});
