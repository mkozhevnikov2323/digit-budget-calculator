import type { ExpenseDraft } from 'features/AddExpense';

export type RecognizedLine = {
  text: string;
  score: number;
};

const MIN_RECOGNITION_SCORE = 0.5;

const amountLabels = [
  /К\s+ОПЛАТЕ/iu,
  /ИТОГО/iu,
  /ИТОГ/iu,
  /TOTAL/iu,
  /СУММА/iu,
];

const amountPattern = /(?:\d{1,3}(?:[\s\u00a0]\d{3})+|\d+)(?:[,.]\d{1,2})?/gu;

const normalizeAmount = (value: string): number | undefined => {
  const amount = Number(value.replace(/[\s\u00a0]/gu, '').replace(',', '.'));

  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
};

const findAmountInText = (text: string): number | undefined => {
  const matches = [...text.matchAll(amountPattern)];

  for (const match of matches.reverse()) {
    const amount = normalizeAmount(match[0]);
    if (amount !== undefined) return amount;
  }

  return undefined;
};

const findAmount = (lines: readonly RecognizedLine[]): number | undefined => {
  for (const label of amountLabels) {
    for (const [index, line] of lines.entries()) {
      const match = label.exec(line.text);
      if (!match) continue;

      const amountOnLabelLine = findAmountInText(
        line.text.slice(match.index + match[0].length),
      );
      if (amountOnLabelLine !== undefined) return amountOnLabelLine;

      const amountOnNextLine = lines[index + 1]
        ? findAmountInText(lines[index + 1].text)
        : undefined;
      if (amountOnNextLine !== undefined) return amountOnNextLine;
    }
  }

  return undefined;
};

const isValidDate = (year: number, month: number, day: number): boolean => {
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const formatDate = (year: number, month: number, day: number): string =>
  [year, month, day]
    .map((part, index) =>
      index === 0 ? String(part).padStart(4, '0') : String(part).padStart(2, '0'),
    )
    .join('-');

const findDate = (lines: readonly RecognizedLine[]): string | undefined => {
  for (const { text } of lines) {
    const isoMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/u);
    if (isoMatch) {
      const [, year, month, day] = isoMatch.map(Number);
      if (isValidDate(year, month, day)) return formatDate(year, month, day);
    }

    const receiptDateMatch = text.match(
      /\b(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})\b/u,
    );
    if (receiptDateMatch) {
      const [, dayText, monthText, yearText] = receiptDateMatch;
      const day = Number(dayText);
      const month = Number(monthText);
      const year =
        yearText.length === 2 ? 2000 + Number(yearText) : Number(yearText);
      if (isValidDate(year, month, day)) return formatDate(year, month, day);
    }
  }

  return undefined;
};

const findRecipient = (lines: readonly RecognizedLine[]): string | undefined => {
  const recipientLabel =
    /^(?:ПРОДАВЕЦ|ОРГАНИЗАЦИЯ|ТОРГОВАЯ\s+ТОЧКА)\s*[:-]\s*(.+)$/iu;
  const storeLine =
    /^(?:МАГАЗИН|СУПЕРМАРКЕТ|КАФЕ|РЕСТОРАН|АПТЕКА)\s+.+/iu;
  const legalEntityLine = /^(?:ООО|ИП|АО|ПАО)\s+.+/iu;
  const isCashierLine = (text: string) => /КАССИР/iu.test(text);

  for (const { text } of lines) {
    const labelledRecipient = text.match(recipientLabel)?.[1]?.trim();
    if (labelledRecipient && !isCashierLine(text)) return labelledRecipient;
  }

  for (const { text } of lines) {
    if (storeLine.test(text) && !isCashierLine(text)) return text;
  }

  for (const { text } of lines) {
    if (legalEntityLine.test(text) && !isCashierLine(text)) return text;
  }

  return undefined;
};

export const parseReceiptLines = (
  recognizedLines: readonly RecognizedLine[],
): ExpenseDraft => {
  const lines = recognizedLines
    .filter(
      ({ text, score }) =>
        text.trim().length > 0 &&
        Number.isFinite(score) &&
        score >= MIN_RECOGNITION_SCORE,
    )
    .map(({ text, score }) => ({ text: text.trim(), score }));

  return {
    amount: findAmount(lines),
    date: findDate(lines),
    recipient: findRecipient(lines),
    title: '',
    category: '',
    comment: '',
  };
};
