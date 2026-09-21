import type { ExpenseRecognizer } from './types';
import { decodeReceiptQr } from './decodeReceiptQr';
import { parseFiscalReceiptQr } from './parseFiscalReceiptQr';
import { parseReceiptLines } from './parseReceiptLines';
import { recognizeLinesWithPaddleOcr } from './paddleOcrAdapter';

export const recognizeExpenseFromImage: ExpenseRecognizer = async (file) => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selected file is not an image');
  }

  let rawQrValue: string | undefined;

  try {
    rawQrValue = await decodeReceiptQr(file);
  } catch {
    rawQrValue = undefined;
  }

  const fiscalQr = rawQrValue
    ? parseFiscalReceiptQr(rawQrValue)
    : undefined;
  let ocrDraft: ReturnType<typeof parseReceiptLines>;

  try {
    const recognizedLines = await recognizeLinesWithPaddleOcr(file);
    ocrDraft = parseReceiptLines(recognizedLines);
  } catch (error) {
    if (!fiscalQr) throw error;
    ocrDraft = parseReceiptLines([]);
  }

  return {
    ...ocrDraft,
    amount: fiscalQr?.amount ?? ocrDraft.amount,
    date: fiscalQr?.date ?? ocrDraft.date,
  };
};
