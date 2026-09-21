import type { BrowserQRCodeReader } from '@zxing/browser';

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

export const decodeReceiptQr: ReceiptQrDecoder = async (file) => {
  const imageUrl = URL.createObjectURL(file);

  try {
    const reader = await getQrReader();
    const result = await reader.decodeFromImageUrl(imageUrl);
    const text = result.getText().trim();

    return text || undefined;
  } catch {
    return undefined;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
};
