export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
export const WINDOW_DAYS = 60;

const TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
};
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_FORMAT = "Enter the date as DD/MM/YYYY, for example 10/11/2026.";

/** Parses DD/MM/YYYY into a calendar day number (UTC, so DST cannot shift a count); null when not a real date. */
function dayNumber(text: string): number | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return Math.floor(date.getTime() / DAY_MS);
}

const todayNumber = (today: Date) =>
  Math.floor(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / DAY_MS);

export function formatDate(dayNo: number): string {
  const d = new Date(dayNo * DAY_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** The earliest date still allowed, as DD/MM/YYYY. */
export const windowStart = (today: Date) => formatDate(todayNumber(today) - WINDOW_DAYS);

/** DD/MM/YYYY to the YYYY-MM-DD the API takes. */
export function toIsoDate(text: string): string {
  const [d, m, y] = text.trim().split("/");
  return `${y}-${m}-${d}`;
}

export function validateAmount(text: string): string | null {
  const cleaned = text.replace(/[,\s]/g, "");
  const n = cleaned === "" ? NaN : Number(cleaned);
  return n > 0 && Number.isFinite(n) ? null : "Enter an amount greater than 0, for example 38.00.";
}

export function validateDate(text: string, today: Date): string | null {
  const day = dayNumber(text);
  if (day === null) return DATE_FORMAT;
  const age = todayNumber(today) - day;
  if (age < 0) return "Enter a date that is today or earlier. Expenses cannot be dated in the future.";
  if (age > WINDOW_DAYS) {
    return `This expense is dated ${age} days ago, and expenses can be at most ${WINDOW_DAYS} days old. Enter a date on or after ${windowStart(today)}.`;
  }
  return null;
}

export function validateReceipt(
  file: { name: string; type: string; size: number },
  maxBytes: number,
): string | null {
  const extensions = TYPES[file.type];
  const name = file.name.toLowerCase();
  if (!extensions || !extensions.some((ext) => name.endsWith(ext))) return "Attach a PDF, JPG or PNG file.";
  if (file.size > maxBytes) {
    return `This file is over the ${maxBytes / (1024 * 1024)} MB limit. Attach a file of ${maxBytes / (1024 * 1024)} MB or less.`;
  }
  return null;
}
