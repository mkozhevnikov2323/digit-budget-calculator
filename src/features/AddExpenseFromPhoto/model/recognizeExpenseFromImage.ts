import type { ExpenseRecognizer } from './types';
import { parseReceiptLines } from './parseReceiptLines';
import { recognizeLinesWithPaddleOcr } from './paddleOcrAdapter';

export const recognizeExpenseFromImage: ExpenseRecognizer = async (file) => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selected file is not an image');
  }

  const recognizedLines = await recognizeLinesWithPaddleOcr(file);

  return parseReceiptLines(recognizedLines);
};
