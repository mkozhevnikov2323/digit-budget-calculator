import {
  parseReceiptLines,
  type RecognizedLine,
} from '../parseReceiptLines';

const lines = (...text: string[]): RecognizedLine[] =>
  text.map((value) => ({ text: value, score: 0.95 }));

describe('parseReceiptLines', () => {
  it('parses a typical Russian receipt conservatively', () => {
    expect(
      parseReceiptLines(
        lines(
          'ООО "Ромашка"',
          'КАССОВЫЙ ЧЕК',
          'Хлеб 89,90',
          'Дата 20.09.2026 14:30',
          'ИТОГ 89,90 ₽',
        ),
      ),
    ).toEqual({
      amount: 89.9,
      date: '2026-09-20',
      recipient: 'ООО "Ромашка"',
      title: '',
      category: '',
      comment: '',
    });
  });

  it.each([
    ['ИТОГ 123,45', 123.45],
    ['К ОПЛАТЕ: 987.65', 987.65],
  ])('parses labelled amount from %s', (text, expectedAmount) => {
    expect(parseReceiptLines(lines(text)).amount).toBe(expectedAmount);
  });

  it('supports a total value placed on the next line', () => {
    expect(parseReceiptLines(lines('ИТОГО', '1 234,56 ₽')).amount).toBe(
      1234.56,
    );
  });

  it('selects the labelled total among several monetary values', () => {
    expect(
      parseReceiptLines(
        lines('Молоко 99,90', 'Хлеб 55.50', 'К ОПЛАТЕ 155,40'),
      ).amount,
    ).toBe(155.4);
  });

  it('normalizes a DD.MM.YYYY date', () => {
    expect(parseReceiptLines(lines('Дата: 07.01.2026')).date).toBe(
      '2026-01-07',
    );
  });

  it.each([
    ['23.08.26', '2026-08-23'],
    ['28.08.26', '2026-08-28'],
    ['29.08.26', '2026-08-29'],
  ])('normalizes the DD.MM.YY date %s', (value, expectedDate) => {
    expect(parseReceiptLines(lines(`Дата: ${value}`)).date).toBe(expectedDate);
  });

  it('keeps an ISO date', () => {
    expect(parseReceiptLines(lines('2026-02-28')).date).toBe('2026-02-28');
  });

  it('does not infer an amount without a supported label', () => {
    expect(parseReceiptLines(lines('Молоко 99,90')).amount).toBeUndefined();
  });

  it('does not return an invalid or missing date', () => {
    expect(parseReceiptLines(lines('Дата: 31.02.2026')).date).toBeUndefined();
    expect(parseReceiptLines(lines('Дата: 31.02.26')).date).toBeUndefined();
    expect(parseReceiptLines(lines('Дата отсутствует')).date).toBeUndefined();
  });

  it('prefers a clear store name over a legal entity line', () => {
    expect(
      parseReceiptLines(
        lines('ООО "Ромашка-Финанс"', 'МАГАЗИН Ромашка'),
      ).recipient,
    ).toBe('МАГАЗИН Ромашка');
  });

  it('does not use a cashier line as the recipient', () => {
    expect(
      parseReceiptLines(lines('ИП ИВАНОВ КАССИР', 'КАССОВЫЙ ЧЕК')).recipient,
    ).toBeUndefined();
  });

  it('ignores empty, noisy, and low-confidence lines', () => {
    expect(
      parseReceiptLines([
        { text: '', score: 0.99 },
        { text: '###', score: 0.99 },
        { text: 'ИТОГ 999,99', score: 0.2 },
        { text: 'К ОПЛАТЕ 150,00', score: 0.9 },
      ]),
    ).toEqual({
      amount: 150,
      date: undefined,
      recipient: undefined,
      title: '',
      category: '',
      comment: '',
    });
  });

  it('returns an empty safe draft for an empty recognition result', () => {
    expect(parseReceiptLines([])).toEqual({
      amount: undefined,
      date: undefined,
      recipient: undefined,
      title: '',
      category: '',
      comment: '',
    });
  });
});
