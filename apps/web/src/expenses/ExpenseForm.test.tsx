import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExpenseForm } from "./ExpenseForm";
import * as client from "./expensesClient";
import { MAX_RECEIPT_BYTES, formatDate } from "./expenseRules";

vi.mock("./expensesClient");

const opts: client.ExpenseOptions = {
  categories: ["Meals", "Travel", "Office supplies"],
  currency: "USD",
  maxReceiptBytes: MAX_RECEIPT_BYTES,
  windowDays: 60,
};
const todayText = () => {
  const n = new Date();
  return formatDate(Math.floor(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / 86_400_000));
};
const user = () => userEvent.setup({ applyAccept: false });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(client.createExpenseDraft).mockResolvedValue({ ok: true });
});
afterEach(() => vi.resetAllMocks());

describe("ExpenseForm", () => {
  it("offers inputs for amount, date, category, description and receipt (AC1)", () => {
    render(<ExpenseForm options={opts} onSaved={vi.fn()} />);
    for (const name of [/amount/i, /date/i, /category/i, /description/i]) {
      expect(screen.getByLabelText(name)).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: /choose file/i })).toBeInTheDocument();
  });

  it("shows exactly the configured categories (AC4)", () => {
    render(<ExpenseForm options={opts} onSaved={vi.fn()} />);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(opts.categories);
  });

  it.each(["0", "-5", "abc"])("shows an inline error for amount %j (AC8)", async (text) => {
    render(<ExpenseForm options={opts} onSaved={vi.fn()} />);
    const amount = screen.getByLabelText(/amount/i);
    await user().type(amount, text);
    expect(screen.getByRole("alert")).toHaveTextContent(/greater than 0/);
    expect(amount).toHaveAttribute("aria-invalid", "true");
  });

  it("shows no error for a positive amount (AC9)", async () => {
    render(<ExpenseForm options={opts} onSaved={vi.fn()} />);
    await user().type(screen.getByLabelText(/amount/i), "38.00");
    expect(screen.queryByText(/greater than 0/)).not.toBeInTheDocument();
  });

  it("shows an inline error for a future date (AC10)", async () => {
    render(<ExpenseForm options={opts} onSaved={vi.fn()} />);
    await user().type(screen.getByLabelText(/date/i), "01/01/2999");
    expect(screen.getByRole("alert")).toHaveTextContent(/today or earlier/);
  });

  it("shows an inline error for a date over 60 days back (AC11)", async () => {
    render(<ExpenseForm options={opts} onSaved={vi.fn()} />);
    await user().type(screen.getByLabelText(/date/i), "01/01/2000");
    expect(screen.getByRole("alert")).toHaveTextContent(/60 days/);
  });

  it("rejects a file in another format and does not attach it (AC6)", async () => {
    render(<ExpenseForm options={opts} onSaved={vi.fn()} />);
    const file = new File(["x"], "notes.docx", { type: "application/msword" });
    await user().upload(screen.getByLabelText("Receipt file"), file);
    expect(await screen.findByRole("alert")).toHaveTextContent(/PDF, JPG or PNG/);
    expect(screen.getByText(/no file attached/i)).toBeInTheDocument();
  });

  it("rejects a file over 10 MB naming the limit and does not attach it (AC7)", async () => {
    render(<ExpenseForm options={opts} onSaved={vi.fn()} />);
    const file = new File(["x"], "big.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "size", { value: MAX_RECEIPT_BYTES + 1 });
    await user().upload(screen.getByLabelText("Receipt file"), file);
    expect(await screen.findByRole("alert")).toHaveTextContent(/10 MB/);
    expect(screen.getByText(/no file attached/i)).toBeInTheDocument();
  });

  it("accepts a file of exactly 10 MB (AC5)", async () => {
    render(<ExpenseForm options={opts} onSaved={vi.fn()} />);
    const file = new File(["x"], "ok.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: MAX_RECEIPT_BYTES });
    await user().upload(screen.getByLabelText("Receipt file"), file);
    expect(screen.getByText(/ok\.png/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("saves a draft with only amount and date (AC13)", async () => {
    const onSaved = vi.fn();
    render(<ExpenseForm options={opts} onSaved={onSaved} />);
    await user().type(screen.getByLabelText(/amount/i), "5");
    await user().type(screen.getByLabelText(/date/i), todayText());
    await user().click(screen.getByRole("button", { name: /save draft/i }));
    expect(client.createExpenseDraft).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Draft saved")).toBeInTheDocument();
    expect(onSaved).toHaveBeenCalled();
  });

  it("saves a draft with an attached receipt (AC3)", async () => {
    render(<ExpenseForm options={opts} onSaved={vi.fn()} />);
    await user().type(screen.getByLabelText(/amount/i), "5");
    await user().type(screen.getByLabelText(/date/i), todayText());
    const file = new File(["x"], "taxi.pdf", { type: "application/pdf" });
    await user().upload(screen.getByLabelText("Receipt file"), file);
    await user().click(screen.getByRole("button", { name: /save draft/i }));
    expect(client.createExpenseDraft).toHaveBeenCalledWith(expect.objectContaining({ amount: "5" }), file);
  });

  it.each(["amount", "date"])("does not save with an empty %s (AC14)", async (empty) => {
    render(<ExpenseForm options={opts} onSaved={vi.fn()} />);
    if (empty !== "amount") await user().type(screen.getByLabelText(/amount/i), "5");
    if (empty !== "date") await user().type(screen.getByLabelText(/date/i), todayText());
    await user().click(screen.getByRole("button", { name: /save draft/i }));
    expect(client.createExpenseDraft).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("tells the employee when the draft could not be saved", async () => {
    vi.mocked(client.createExpenseDraft).mockResolvedValue({ ok: false, code: "unknown" });
    render(<ExpenseForm options={opts} onSaved={vi.fn()} />);
    await user().type(screen.getByLabelText(/amount/i), "5");
    await user().type(screen.getByLabelText(/date/i), todayText());
    await user().click(screen.getByRole("button", { name: /save draft/i }));
    expect(await screen.findByText(/could not be saved/i)).toBeInTheDocument();
  });
});
