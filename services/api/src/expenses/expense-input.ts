import { BadRequestException } from '@nestjs/common';

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
export const RECEIPT_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
};
export const DATE_WINDOW_DAYS = 60;

export interface ExpenseDraftInput {
  amount: unknown;
  date: unknown;
  category?: unknown;
  description?: unknown;
}

/** The validated, storage-ready form of an ExpenseDraftInput. */
export interface ExpenseDraftFields {
  amountMinor: number;
  incurredOn: string;
  category: string | null;
  description: string | null;
}

const reject = (code: string) => new BadRequestException({ code });
const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const parseAmount = (value: unknown): number => {
  const n =
    typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) {
    throw reject('amount_invalid');
  }
  const minor = Math.round(n * 100);
  if (minor < 1) throw reject('amount_invalid');
  return minor;
};

/** Days since the epoch for a UTC calendar day, so DST cannot shift a count. */
const utcDay = (y: number, m: number, d: number) =>
  Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);

const parseDate = (value: unknown, today: Date): string => {
  const match = typeof value === 'string' ? ISO_DATE.exec(value) : null;
  if (!match) throw reject('date_invalid');
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const real = new Date(Date.UTC(y, m - 1, d));
  if (real.getUTCMonth() !== m - 1 || real.getUTCDate() !== d) {
    throw reject('date_invalid');
  }
  const age =
    utcDay(
      today.getUTCFullYear(),
      today.getUTCMonth() + 1,
      today.getUTCDate(),
    ) - utcDay(y, m, d);
  if (age < 0) throw reject('date_in_future');
  if (age > DATE_WINDOW_DAYS) throw reject('date_too_old');
  return value as string;
};

const optionalText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

export function parseExpenseDraft(
  body: unknown,
  categories: string[],
  today: Date,
): ExpenseDraftFields {
  const raw = (body ?? {}) as Record<string, unknown>;
  const amountMinor = parseAmount(raw.amount);
  const incurredOn = parseDate(raw.date, today);
  const category = optionalText(raw.category);
  if (category !== null && !categories.includes(category)) {
    throw reject('category_invalid');
  }
  return {
    amountMinor,
    incurredOn,
    category,
    description: optionalText(raw.description),
  };
}

export function assertReceipt(file: {
  originalname: string;
  mimetype: string;
  size: number;
}): void {
  const extensions = RECEIPT_TYPES[file.mimetype];
  const name = file.originalname.toLowerCase();
  if (!extensions || !extensions.some((ext) => name.endsWith(ext))) {
    throw reject('receipt_type_invalid');
  }
  if (file.size > MAX_RECEIPT_BYTES) throw reject('receipt_too_large');
}
