import type { ExpenseRecognizer } from './types';
import { decodeReceiptQr } from './decodeReceiptQr';
import { parseFiscalReceiptQr } from './parseFiscalReceiptQr';

export const QR_NOT_FOUND_MESSAGE = 'Не удалось считать QR-код с чека.';
export const INVALID_FISCAL_QR_MESSAGE =
  'QR-код найден, но не содержит корректные данные кассового чека.';

export class ReceiptQrRecognitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReceiptQrRecognitionError';
  }
}

const logQrDiagnostic = (
  event:
    | 'decode-started'
    | 'not-found'
    | 'found'
    | 'fiscal-invalid'
    | 'fiscal-valid',
  details?: { date: string; amount: number },
) => {
  if (process.env.NODE_ENV === 'production') return;

  console.info('[Receipt QR]', { event, ...details });
};

export const recognizeExpenseFromImage: ExpenseRecognizer = async (file) => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selected file is not an image');
  }

  logQrDiagnostic('decode-started');
  let rawQrValue: string | undefined;

  try {
    rawQrValue = await decodeReceiptQr(file);
  } catch {
    rawQrValue = undefined;
  }

  if (!rawQrValue) {
    logQrDiagnostic('not-found');
    throw new ReceiptQrRecognitionError(QR_NOT_FOUND_MESSAGE);
  }

  logQrDiagnostic('found');

  const fiscalQr = parseFiscalReceiptQr(rawQrValue);

  if (!fiscalQr) {
    logQrDiagnostic('fiscal-invalid');
    throw new ReceiptQrRecognitionError(INVALID_FISCAL_QR_MESSAGE);
  }

  logQrDiagnostic('fiscal-valid', {
    date: fiscalQr.date,
    amount: fiscalQr.amount,
  });

  return {
    amount: fiscalQr.amount,
    date: fiscalQr.date,
    title: '',
    recipient: '',
    category: '',
    comment: '',
  };
};
