import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AuditEntry } from '../audit/audit-entry.entity';
import { FakeClock } from '../auth/testing/fakes';
import { Expense } from './expense.entity';
import { ExpensesService } from './expenses.service';
import { InMemoryReceiptStorage } from './testing/fakes';

describe('ExpensesService', () => {
  const valid = { amount: 12.5, date: '2026-11-10' };
  const pdf = (size: number) => ({
    originalname: 'taxi.pdf',
    mimetype: 'application/pdf',
    size,
    buffer: Buffer.alloc(size),
  });

  const setup = (failTransaction = false) => {
    const saved: { entity: unknown; value: Record<string, unknown> }[] = [];
    const manager = {
      save: jest.fn(async (entity, v) => {
        saved.push({ entity, value: v });
        return { ...v };
      }),
    };
    const dataSource = {
      transaction: jest.fn(async (fn) => {
        if (failTransaction) throw new Error('db down');
        return fn(manager);
      }),
    };
    const config = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'EXPENSE_CATEGORIES') return 'Meals, Travel,Office supplies';
        return fallback;
      }),
    };
    const storage = new InMemoryReceiptStorage();
    const service = new ExpensesService(
      dataSource as unknown as DataSource,
      config as unknown as ConfigService,
      new FakeClock(new Date('2026-11-20T10:00:00Z')),
      storage,
    );
    const expenses = () =>
      saved.filter((s) => s.entity === Expense).map((s) => s.value);
    const audit = () =>
      saved.filter((s) => s.entity === AuditEntry).map((s) => s.value);
    return { service, storage, expenses, audit };
  };

  it('lists exactly the configured categories (AC4)', () => {
    expect(setup().service.categories()).toEqual([
      'Meals',
      'Travel',
      'Office supplies',
    ]);
  });

  it('saves a draft without a receipt and audits it (AC2)', async () => {
    const { service, expenses, audit } = setup();
    const d = await service.createDraft(
      { ...valid, category: 'Travel', description: 'Taxi' },
      undefined,
      'u1',
    );
    expect(d).toMatchObject({
      status: 'draft',
      amountMinor: 1250,
      receiptKey: null,
      ownerUserId: 'u1',
    });
    expect(expenses()).toHaveLength(1);
    expect(audit()).toContainEqual(
      expect.objectContaining({ entity: 'expense', action: 'create' }),
    );
  });

  it('stores the receipt in object storage and only metadata in the row (AC3)', async () => {
    const { service, storage } = setup();
    const w = await service.createDraft(valid, pdf(1024), 'u1');
    expect(w.receiptKey).toMatch(/^receipts\//);
    expect(w.receiptKey).not.toContain('taxi');
    expect(storage.objects.has(w.receiptKey!)).toBe(true);
    expect(w).toMatchObject({
      receiptName: 'taxi.pdf',
      receiptContentType: 'application/pdf',
      receiptSizeBytes: 1024,
    });
  });

  it('saves a draft with only amount and date (AC13)', async () => {
    const d = await setup().service.createDraft(
      { amount: 5, date: '2026-11-10' },
      undefined,
      'u1',
    );
    expect(d).toMatchObject({
      category: null,
      description: null,
      receiptKey: null,
    });
  });

  it('rejects an unknown category (AC4)', async () => {
    await expect(
      setup().service.createDraft(
        { ...valid, category: 'Yachts' },
        undefined,
        'u1',
      ),
    ).rejects.toMatchObject({ response: { code: 'category_invalid' } });
  });

  it.each([
    ['amount', { date: '2026-11-10' }, 'amount_invalid'],
    ['date', { amount: 5 }, 'date_invalid'],
  ])('does not save when %s is empty (AC14)', async (_n, body, code) => {
    const { service, expenses, storage } = setup();
    await expect(
      service.createDraft(body, pdf(10), 'u1'),
    ).rejects.toMatchObject({ response: { code } });
    expect(expenses()).toHaveLength(0);
    expect(storage.objects.size).toBe(0);
  });

  it('rejects a bad receipt before writing anything (AC6, AC7)', async () => {
    const { service, storage } = setup();
    await expect(
      service.createDraft(valid, { ...pdf(10), mimetype: 'image/gif' }, 'u1'),
    ).rejects.toMatchObject({ response: { code: 'receipt_type_invalid' } });
    expect(storage.objects.size).toBe(0);
  });

  it('removes the uploaded receipt when the transaction fails', async () => {
    const { service, storage } = setup(true);
    await expect(service.createDraft(valid, pdf(10), 'u1')).rejects.toThrow(
      'db down',
    );
    expect(storage.objects.size).toBe(0);
  });
});
