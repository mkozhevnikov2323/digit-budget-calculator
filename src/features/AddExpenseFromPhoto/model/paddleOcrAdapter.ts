import type { PaddleOCRCreateOptions } from '@paddleocr/paddleocr-js';
import type { RecognizedLine } from './parseReceiptLines';

const RUSSIAN_RECOGNITION_MODEL_URL =
  'https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/eslav_PP-OCRv5_mobile_rec_onnx_infer.tar';
const ONNX_RUNTIME_WASM_PATH =
  'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/';

// PaddleOCR.js 0.4.2 does not resolve `lang: "ru"` for PP-OCRv5 yet, so use
// its official East Slavic recognition model explicitly.
const paddleOcrOptions = {
  ocrVersion: 'PP-OCRv5',
  textDetectionModelName: 'PP-OCRv5_mobile_det',
  textRecognitionModelName: 'eslav_PP-OCRv5_mobile_rec',
  textRecognitionModelAsset: {
    url: RUSSIAN_RECOGNITION_MODEL_URL,
  },
  ortOptions: {
    backend: 'wasm',
    wasmPaths: ONNX_RUNTIME_WASM_PATH,
  },
} satisfies PaddleOCRCreateOptions;

type PaddleOcrFailurePhase = 'sdk-import' | 'initialization' | 'prediction';

type PaddleOcrFailureKind =
  | 'sdk-import'
  | 'model-download'
  | 'model-archive'
  | 'model-name'
  | 'onnx-runtime'
  | 'opencv-runtime'
  | 'image-decoding'
  | 'prediction'
  | 'initialization';

const classifyPaddleOcrFailure = (
  phase: PaddleOcrFailurePhase,
  error: unknown,
): PaddleOcrFailureKind => {
  if (phase === 'sdk-import') return 'sdk-import';

  const message = error instanceof Error ? error.message : String(error);

  if (/failed to download|\bhttp\b|fetch/i.test(message)) {
    return 'model-download';
  }
  if (/tar archive|tar entry|inference\.(?:onnx|yml).*not found/i.test(message)) {
    return 'model-archive';
  }
  if (/model_name|declares model/i.test(message)) return 'model-name';
  if (/onnx|webassembly|\bwasm\b|available backend|inferencesession/i.test(message)) {
    return 'onnx-runtime';
  }
  if (/opencv|\bcv\b|cv\.|\bmat\b/i.test(message)) return 'opencv-runtime';
  if (phase === 'prediction' && /decode|image|bitmap|canvas/i.test(message)) {
    return 'image-decoding';
  }

  return phase;
};

const logPaddleOcrFailure = (
  phase: PaddleOcrFailurePhase,
  error: unknown,
  file?: File,
) => {
  if (process.env.NODE_ENV === 'production') return;

  console.error(
    '[PaddleOCR] Operation failed',
    {
      phase,
      kind: classifyPaddleOcrFailure(phase, error),
      detectionModel: paddleOcrOptions.textDetectionModelName,
      recognitionModel: paddleOcrOptions.textRecognitionModelName,
      ...(file && { fileType: file.type, fileSize: file.size }),
    },
    error,
  );
};

type PaddleOcrInstance = Awaited<
  ReturnType<
    (typeof import('@paddleocr/paddleocr-js'))['PaddleOCR']['create']
  >
>;

let paddleOcrPromise: Promise<PaddleOcrInstance> | undefined;

const createPaddleOcr = async (): Promise<PaddleOcrInstance> => {
  let PaddleOCR: (typeof import('@paddleocr/paddleocr-js'))['PaddleOCR'];

  try {
    ({ PaddleOCR } = await import('@paddleocr/paddleocr-js'));
  } catch (error) {
    logPaddleOcrFailure('sdk-import', error);
    throw error;
  }

  try {
    return await PaddleOCR.create(paddleOcrOptions);
  } catch (error) {
    logPaddleOcrFailure('initialization', error);
    throw error;
  }
};

const getPaddleOcr = () => {
  if (!paddleOcrPromise) {
    paddleOcrPromise = createPaddleOcr().catch((error) => {
      paddleOcrPromise = undefined;
      throw error;
    });
  }

  return paddleOcrPromise;
};

export const recognizeLinesWithPaddleOcr = async (
  file: File,
): Promise<RecognizedLine[]> => {
  const paddleOcr = await getPaddleOcr();

  let result: Awaited<ReturnType<PaddleOcrInstance['predict']>>[number];

  try {
    [result] = await paddleOcr.predict(file);
  } catch (error) {
    logPaddleOcrFailure('prediction', error, file);
    throw error;
  }

  return (result?.items ?? []).map(({ text, score }) => ({ text, score }));
};
