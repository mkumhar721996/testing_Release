import {
  assertReceipt,
  MAX_RECEIPT_BYTES,
  parseExpenseDraft,
} from './expense-input';

const cats = ['Meals', 'Travel'];
const today = new Date('2026-11-20T12:00:00Z');
const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as { response: { code: string } }).response.code;
  }
  return null;
};

describe('parseExpenseDraft', () => {
  it.each([0, -5, 'abc', undefined, '', NaN])(
    'rejects amount %p (AC8, AC14)',
    (amount) => {
      expect(codeOf(() => parseExpenseDraft({ amount, date: '2026-11-10' }, cats, today))).toBe(
        'amount_invalid',
      );
    },
  );

  it('accepts a positive amount and stores minor units (AC9)', () => {
    expect(
      parseExpenseDraft({ amount: 12.5, date: '2026-11-10' }, cats, today),
    ).toEqual({
      amountMinor: 1250,
      incurredOn: '2026-11-10',
      category: null,
      description: null,
    });
  });

  it('rejects an empty date (AC14)', () => {
    expect(codeOf(() => parseExpenseDraft({ amount: 1 }, cats, today))).toBe(
      'date_invalid',
    );
  });

  it('rejects a future date (AC10)', () => {
    expect(
      codeOf(() => parseExpenseDraft({ amount: 1, date: '2026-11-21' }, cats, today)),
    ).toBe('date_in_future');
  });

  it('rejects a date 61 days back (AC11)', () => {
    expect(
      codeOf(() => parseExpenseDraft({ amount: 1, date: '2026-09-20' }, cats, today)),
    ).toBe('date_too_old');
  });

  it('accepts today and exactly 60 days back (AC12)', () => {
    expect(() =>
      parseExpenseDraft({ amount: 1, date: '2026-09-21' }, cats, today),
    ).not.toThrow();
    expect(() =>
      parseExpenseDraft({ amount: 1, date: '2026-11-20' }, cats, today),
    ).not.toThrow();
  });

  it('counts days in UTC across a DST change (AC12)', () => {
    const t = new Date('2026-11-02T00:30:00Z');
    expect(() =>
      parseExpenseDraft({ amount: 1, date: '2026-09-03' }, cats, t),
    ).not.toThrow();
    expect(
      codeOf(() => parseExpenseDraft({ amount: 1, date: '2026-09-02' }, cats, t)),
    ).toBe('date_too_old');
  });

  it('rejects an impossible calendar date', () => {
    expect(
      codeOf(() => parseExpenseDraft({ amount: 1, date: '2026-02-31' }, cats, today)),
    ).toBe('date_invalid');
  });

  it('accepts only configured categories (AC4)', () => {
    const body = { amount: 1, date: '2026-11-10' };
    expect(parseExpenseDraft({ ...body, category: 'Travel' }, cats, today).category).toBe('Travel');
    expect(
      codeOf(() => parseExpenseDraft({ ...body, category: 'Yachts' }, cats, today)),
    ).toBe('category_invalid');
  });

  it('treats blank optional fields as null (AC13)', () => {
    const f = parseExpenseDraft(
      { amount: '5', date: '2026-11-10', category: '', description: ' ' },
      cats,
      today,
    );
    expect(f).toMatchObject({ category: null, description: null, amountMinor: 500 });
  });
});

describe('assertReceipt', () => {
  it.each([
    ['a.pdf', 'application/pdf'],
    ['a.jpg', 'image/jpeg'],
    ['a.png', 'image/png'],
  ])('accepts %s at exactly 10 MB (AC5)', (originalname, mimetype) => {
    expect(() =>
      assertReceipt({ originalname, mimetype, size: MAX_RECEIPT_BYTES }),
    ).not.toThrow();
  });

  it.each([
    ['a.gif', 'image/gif'],
    ['a.docx', 'application/msword'],
    ['a.pdf', 'image/png'],
  ])('rejects %s (AC6)', (originalname, mimetype) => {
    expect(codeOf(() => assertReceipt({ originalname, mimetype, size: 10 }))).toBe(
      'receipt_type_invalid',
    );
  });

  it.each([
    ['a.pdf', 'application/pdf'],
    ['a.jpg', 'image/jpeg'],
    ['a.png', 'image/png'],
  ])('rejects %s over 10 MB (AC7)', (originalname, mimetype) => {
    expect(
      codeOf(() =>
        assertReceipt({ originalname, mimetype, size: MAX_RECEIPT_BYTES + 1 }),
      ),
    ).toBe('receipt_too_large');
  });
});
