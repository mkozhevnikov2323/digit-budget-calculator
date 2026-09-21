import { PaddleOCR } from '@paddleocr/paddleocr-js';
import { recognizeLinesWithPaddleOcr } from '../paddleOcrAdapter';

jest.mock(
  '@paddleocr/paddleocr-js',
  () => ({
    PaddleOCR: {
      create: jest.fn(),
    },
  }),
  { virtual: true },
);

const mockCreate = PaddleOCR.create as jest.Mock;

describe('paddleOcrAdapter', () => {
  it('initializes PaddleOCR lazily once and returns provider-independent lines', async () => {
    const predict = jest.fn().mockResolvedValue([
      {
        items: [
          {
            poly: [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 10],
            ],
            text: 'ИТОГ 123,45',
            score: 0.98,
          },
        ],
      },
    ]);
    mockCreate.mockResolvedValue({ predict });

    expect(mockCreate).not.toHaveBeenCalled();

    const firstFile = new File(['first'], 'first.png', { type: 'image/png' });
    const secondFile = new File(['second'], 'second.jpg', {
      type: 'image/jpeg',
    });

    await expect(recognizeLinesWithPaddleOcr(firstFile)).resolves.toEqual([
      { text: 'ИТОГ 123,45', score: 0.98 },
    ]);
    await recognizeLinesWithPaddleOcr(secondFile);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
      ocrVersion: 'PP-OCRv5',
      textDetectionModelName: 'PP-OCRv5_mobile_det',
      textRecognitionModelName: 'eslav_PP-OCRv5_mobile_rec',
      textRecognitionModelAsset: {
        url: 'https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/eslav_PP-OCRv5_mobile_rec_onnx_infer.tar',
      },
      ortOptions: {
        backend: 'auto',
      },
    });
    expect(predict).toHaveBeenNthCalledWith(1, firstFile);
    expect(predict).toHaveBeenNthCalledWith(2, secondFile);
  });
});
