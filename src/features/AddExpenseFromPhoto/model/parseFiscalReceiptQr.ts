export type FiscalReceiptQr = {
  dateTime: string;
  date: string;
  amount: number;
  fiscalDriveNumber: string;
  fiscalDocumentNumber: string;
  fiscalSign: string;
  operationType: number;
};

const parseDateTime = (
  value: string | undefined,
): Pick<FiscalReceiptQr, 'dateTime' | 'date'> | undefined => {
  const match = value?.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?$/u,
  );
  if (!match) return undefined;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = secondText === undefined ? undefined : Number(secondText);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59 ||
    (second !== undefined && second > 59)
  ) {
    return undefined;
  }

  const normalizedDate = `${yearText}-${monthText}-${dayText}`;
  const normalizedTime = `${hourText}:${minuteText}${
    secondText === undefined ? '' : `:${secondText}`
  }`;

  return {
    date: normalizedDate,
    dateTime: `${normalizedDate}T${normalizedTime}`,
  };
};

const parseAmount = (value: string | undefined): number | undefined => {
  if (!value || !/^\d+(?:[.,]\d{1,2})?$/u.test(value)) return undefined;

  const amount = Number(value.replace(',', '.'));
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
};

const parsePositiveInteger = (value: string | undefined): number | undefined => {
  if (!value || !/^\d+$/u.test(value)) return undefined;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const getRequiredDigits = (value: string | undefined): string | undefined =>
  value && /^\d+$/u.test(value) ? value : undefined;

export const parseFiscalReceiptQr = (
  rawValue: string,
): FiscalReceiptQr | undefined => {
  const parameters = new Map<string, string>();

  for (const [key, value] of new URLSearchParams(rawValue.trim())) {
    parameters.set(key.toLowerCase(), value.trim());
  }

  const parsedDateTime = parseDateTime(parameters.get('t'));
  const amount = parseAmount(parameters.get('s'));
  const fiscalDriveNumber = getRequiredDigits(parameters.get('fn'));
  const fiscalDocumentNumber = getRequiredDigits(
    parameters.get('i') ?? parameters.get('fd'),
  );
  const fiscalSign = getRequiredDigits(parameters.get('fp'));
  const operationType = parsePositiveInteger(parameters.get('n'));

  if (
    !parsedDateTime ||
    amount === undefined ||
    !fiscalDriveNumber ||
    !fiscalDocumentNumber ||
    !fiscalSign ||
    operationType === undefined
  ) {
    return undefined;
  }

  return {
    ...parsedDateTime,
    amount,
    fiscalDriveNumber,
    fiscalDocumentNumber,
    fiscalSign,
    operationType,
  };
};
