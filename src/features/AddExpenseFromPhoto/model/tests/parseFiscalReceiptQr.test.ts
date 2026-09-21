import { parseFiscalReceiptQr } from '../parseFiscalReceiptQr';

describe('parseFiscalReceiptQr', () => {
  it('parses a Russian fiscal receipt QR payload', () => {
    expect(
      parseFiscalReceiptQr(
        't=20260828T2046&s=249.99&fn=9287440300991111&i=109331&fp=1234567890&n=1',
      ),
    ).toEqual({
      dateTime: '2026-08-28T20:46',
      date: '2026-08-28',
      amount: 249.99,
      fiscalDriveNumber: '9287440300991111',
      fiscalDocumentNumber: '109331',
      fiscalSign: '1234567890',
      operationType: 1,
    });
  });

  it('accepts FD as the fiscal document parameter and comma amounts', () => {
    expect(
      parseFiscalReceiptQr(
        'T=20260828T204615&S=1000,50&FN=111&FD=222&FP=333&N=2',
      ),
    ).toEqual({
      dateTime: '2026-08-28T20:46:15',
      date: '2026-08-28',
      amount: 1000.5,
      fiscalDriveNumber: '111',
      fiscalDocumentNumber: '222',
      fiscalSign: '333',
      operationType: 2,
    });
  });

  it.each([
    ['not a fiscal QR'],
    ['t=20260230T2046&s=249.99&fn=1&i=2&fp=3&n=1'],
    ['t=20260828T2460&s=249.99&fn=1&i=2&fp=3&n=1'],
    ['t=20260828T2046&s=-1&fn=1&i=2&fp=3&n=1'],
    ['t=20260828T2046&s=249.99&fn=1&i=2&n=1'],
  ])('rejects an invalid or incomplete QR payload: %s', (value) => {
    expect(parseFiscalReceiptQr(value)).toBeUndefined();
  });
});
