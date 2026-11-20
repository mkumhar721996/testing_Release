import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { AuditEntry } from '../audit/audit-entry.entity';
import { Clock } from '../auth/clock';
import { Expense } from './expense.entity';
import {
  assertReceipt,
  DATE_WINDOW_DAYS,
  ExpenseDraftInput,
  MAX_RECEIPT_BYTES,
  parseExpenseDraft,
} from './expense-input';
import { ReceiptStorage } from './receipt-storage';

export interface ReceiptUpload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class ExpensesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly clock: Clock,
    private readonly storage: ReceiptStorage,
  ) {}

  options() {
    return {
      categories: this.categories(),
      currency: this.currency(),
      maxReceiptBytes: MAX_RECEIPT_BYTES,
      windowDays: DATE_WINDOW_DAYS,
    };
  }

  categories(): string[] {
    return this.config
      .get<string>('EXPENSE_CATEGORIES', '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
  }

  async createDraft(
    input: Partial<ExpenseDraftInput>,
    receipt: ReceiptUpload | undefined,
    actorUserId: string,
  ): Promise<Expense> {
    const fields = parseExpenseDraft(
      input,
      this.categories(),
      this.clock.now(),
    );
    if (receipt) assertReceipt(receipt);

    const id = randomUUID();
    const key = receipt ? `receipts/${id}/${randomUUID()}` : null;
    if (receipt && key) {
      await this.storage.put(key, receipt.buffer, receipt.mimetype);
    }
    try {
      return await this.dataSource.transaction(async (em) => {
        const saved = await em.save(Expense, {
          id,
          ownerUserId: actorUserId,
          ...fields,
          currency: this.currency(),
          receiptKey: key,
          receiptName: receipt?.originalname ?? null,
          receiptContentType: receipt?.mimetype ?? null,
          receiptSizeBytes: receipt?.size ?? null,
          status: 'draft',
        });
        await em.save(AuditEntry, {
          actorUserId,
          entity: 'expense',
          entityId: id,
          action: 'create',
          changes: {
            ...fields,
            receiptName: receipt?.originalname ?? null,
            receiptKey: key,
          },
        });
        return saved;
      });
    } catch (err) {
      if (key) await this.storage.remove(key).catch(() => undefined);
      throw err;
    }
  }

  private currency(): string {
    return this.config.get<string>(
      'EXPENSE_CURRENCY',
      this.config.get<string>('PAY_CURRENCY', 'GBP'),
    );
  }
}
