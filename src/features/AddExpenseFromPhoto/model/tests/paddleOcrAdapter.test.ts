jest.mock(
  '@paddleocr/paddleocr-js',
  () => ({
    PaddleOCR: {
      create: jest.fn(),
    },
  }),
  { virtual: true },
);

const loadAdapter = async () => {
  jest.resetModules();
  const { PaddleOCR } = await import('@paddleocr/paddleocr-js');
  const { recognizeLinesWithPaddleOcr } = await import('../paddleOcrAdapter');

  return {
    mockCreate: PaddleOCR.create as jest.Mock,
    recognizeLinesWithPaddleOcr,
  };
};

describe('paddleOcrAdapter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('initializes PaddleOCR lazily once and returns provider-independent lines', async () => {
    const { mockCreate, recognizeLinesWithPaddleOcr } = await loadAdapter();
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
        backend: 'wasm',
        wasmPaths:
          'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/',
      },
    });
    expect(predict).toHaveBeenNthCalledWith(1, firstFile);
    expect(predict).toHaveBeenNthCalledWith(2, secondFile);
  });

  it('logs and rethrows a categorized initialization error', async () => {
    const { mockCreate, recognizeLinesWithPaddleOcr } = await loadAdapter();
    const originalError = new Error(
      'Failed to download model asset: HTTP 404',
    );
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockCreate.mockRejectedValue(originalError);

    await expect(
      recognizeLinesWithPaddleOcr(
        new File(['image'], 'receipt.jpg', { type: 'image/jpeg' }),
      ),
    ).rejects.toBe(originalError);

    expect(consoleError).toHaveBeenCalledWith(
      '[PaddleOCR] Operation failed',
      expect.objectContaining({
        phase: 'initialization',
        kind: 'model-download',
        detectionModel: 'PP-OCRv5_mobile_det',
        recognitionModel: 'eslav_PP-OCRv5_mobile_rec',
      }),
      originalError,
    );
  });

  it('identifies ONNX Runtime initialization failures', async () => {
    const { mockCreate, recognizeLinesWithPaddleOcr } = await loadAdapter();
    const originalError = new Error(
      'no available backend found: WebAssembly.instantiate failed',
    );
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockCreate.mockRejectedValue(originalError);

    await expect(
      recognizeLinesWithPaddleOcr(
        new File(['image'], 'receipt.jpg', { type: 'image/jpeg' }),
      ),
    ).rejects.toBe(originalError);

    expect(consoleError).toHaveBeenCalledWith(
      '[PaddleOCR] Operation failed',
      expect.objectContaining({
        phase: 'initialization',
        kind: 'onnx-runtime',
      }),
      originalError,
    );
  });

  it('logs image metadata without logging its name when prediction fails', async () => {
    const { mockCreate, recognizeLinesWithPaddleOcr } = await loadAdapter();
    const originalError = new Error('Failed to decode image bitmap');
    const predict = jest.fn().mockRejectedValue(originalError);
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockCreate.mockResolvedValue({ predict });
    const file = new File(['image'], 'private-receipt.jpg', {
      type: 'image/jpeg',
    });

    await expect(recognizeLinesWithPaddleOcr(file)).rejects.toBe(originalError);

    expect(consoleError).toHaveBeenCalledWith(
      '[PaddleOCR] Operation failed',
      expect.not.objectContaining({ fileName: expect.anything() }),
      originalError,
    );
    expect(consoleError).toHaveBeenCalledWith(
      '[PaddleOCR] Operation failed',
      expect.objectContaining({
        phase: 'prediction',
        kind: 'image-decoding',
        fileType: 'image/jpeg',
        fileSize: file.size,
      }),
      originalError,
    );
  });
});
