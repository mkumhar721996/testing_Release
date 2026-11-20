import { describe, expect, it } from "vitest";
import { MAX_RECEIPT_BYTES, toIsoDate, validateAmount, validateDate, validateReceipt } from "./expenseRules";

const MAX = MAX_RECEIPT_BYTES;
const today = new Date("2026-11-20T00:00:00");

describe("validateAmount", () => {
  it.each(["0", "-5", "abc", ""])("rejects %j (AC8, AC14)", (text) => {
    expect(validateAmount(text)).toMatch(/greater than 0/);
  });

  it("accepts a positive number (AC9)", () => {
    expect(validateAmount("38.00")).toBeNull();
  });
});

describe("validateDate", () => {
  it("rejects a future date (AC10)", () => {
    expect(validateDate("21/11/2026", today)).toMatch(/today or earlier/);
  });

  it("rejects a date 61 days back (AC11)", () => {
    expect(validateDate("20/09/2026", today)).toMatch(/60 days/);
  });

  it("accepts exactly 60 days back and today (AC12)", () => {
    expect(validateDate("21/09/2026", today)).toBeNull();
    expect(validateDate("20/11/2026", today)).toBeNull();
  });

  it("counts calendar days across a DST change (AC12)", () => {
    const t = new Date("2026-11-02T00:00:00");
    expect(validateDate("03/09/2026", t)).toBeNull();
    expect(validateDate("02/09/2026", t)).toMatch(/60 days/);
  });

  it.each(["", "2026-11-10", "31/02/2026"])("rejects %j as not a date (AC14)", (text) => {
    expect(validateDate(text, today)).toMatch(/DD\/MM\/YYYY/);
  });

  it("converts to the API's ISO form", () => {
    expect(toIsoDate("05/11/2026")).toBe("2026-11-05");
  });
});

describe("validateReceipt", () => {
  it.each([
    ["a.pdf", "application/pdf"],
    ["a.jpg", "image/jpeg"],
    ["a.png", "image/png"],
  ])("accepts %s at exactly 10 MB (AC5)", (name, type) => {
    expect(validateReceipt({ name, type, size: MAX }, MAX)).toBeNull();
  });

  it.each([
    ["a.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["a.gif", "image/gif"],
  ])("rejects %s as the wrong format (AC6)", (name, type) => {
    expect(validateReceipt({ name, type, size: 10 }, MAX)).toMatch(/PDF, JPG or PNG/);
  });

  it.each([
    ["a.pdf", "application/pdf"],
    ["a.jpg", "image/jpeg"],
    ["a.png", "image/png"],
  ])("rejects %s over 10 MB naming the limit (AC7)", (name, type) => {
    expect(validateReceipt({ name, type, size: MAX + 1 }, MAX)).toMatch(/10 MB/);
  });
});
