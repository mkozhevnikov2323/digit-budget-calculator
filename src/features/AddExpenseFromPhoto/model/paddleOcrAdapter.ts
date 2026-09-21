import type { PaddleOCRCreateOptions } from '@paddleocr/paddleocr-js';
import type { RecognizedLine } from './parseReceiptLines';

const RUSSIAN_RECOGNITION_MODEL_URL =
  'https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/eslav_PP-OCRv5_mobile_rec_onnx_infer.tar';

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
    backend: 'auto',
  },
} satisfies PaddleOCRCreateOptions;

type PaddleOcrInstance = Awaited<
  ReturnType<
    (typeof import('@paddleocr/paddleocr-js'))['PaddleOCR']['create']
  >
>;

let paddleOcrPromise: Promise<PaddleOcrInstance> | undefined;

const getPaddleOcr = () => {
  if (!paddleOcrPromise) {
    paddleOcrPromise = import('@paddleocr/paddleocr-js')
      .then(({ PaddleOCR }) => PaddleOCR.create(paddleOcrOptions))
      .catch((error) => {
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
  const [result] = await paddleOcr.predict(file);

  return (result?.items ?? []).map(({ text, score }) => ({ text, score }));
};
