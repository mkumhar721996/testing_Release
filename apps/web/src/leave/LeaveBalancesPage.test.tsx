import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeaveBalancesPage } from "./LeaveBalancesPage";
import * as client from "./leaveClient";

vi.mock("./leaveClient");

afterEach(() => vi.resetAllMocks());

const ok = <T,>(value: T) => ({ ok: true as const, value });
const ada = { id: "e1", displayName: "Ada Lovelace" };
const balances = (annual: number | null, sick: number | null) => [
  { leaveTypeId: "annual", name: "Annual leave", exempt: false, days: annual },
  { leaveTypeId: "sick", name: "Sick leave", exempt: false, days: sick },
];
const rowOf = (name: string) => screen.getByRole("cell", { name }).closest("tr") as HTMLElement;

async function open() {
  render(<LeaveBalancesPage />);
  await userEvent.selectOptions(await screen.findByLabelText("Employee"), "e1");
}

describe("LeaveBalancesPage", () => {
  it("shows 'Not set' with no days figure (AC11)", async () => {
    vi.mocked(client.listEmployees).mockResolvedValue(ok([ada]));
    vi.mocked(client.listBalances).mockResolvedValue(ok(balances(10, null)));
    await open();
    await screen.findByRole("cell", { name: "Sick leave" });
    const row = rowOf("Sick leave");
    expect(within(row).getByText("Not set")).toBeInTheDocument();
    expect(within(row).queryByText(/day/)).not.toBeInTheDocument();
    expect(within(rowOf("Annual leave")).getByText("10 days")).toBeInTheDocument();
  });

  it("sets the balance (AC2)", async () => {
    vi.mocked(client.listEmployees).mockResolvedValue(ok([ada]));
    vi.mocked(client.listBalances).mockResolvedValue(ok(balances(null, null)));
    vi.mocked(client.setBalance).mockResolvedValue(ok({ leaveTypeId: "annual", days: 10 }));
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Set Annual leave balance for Ada Lovelace" }));
    await userEvent.type(screen.getByLabelText("Days"), "10");
    await userEvent.click(screen.getByRole("button", { name: "Save balance" }));
    expect(client.setBalance).toHaveBeenCalledWith("e1", "annual", 10);
    expect(await screen.findByText("10 days")).toBeInTheDocument();
  });

  it("adjusts the balance (AC3) and leaves the others alone (AC4)", async () => {
    vi.mocked(client.listEmployees).mockResolvedValue(ok([ada]));
    vi.mocked(client.listBalances).mockResolvedValue(ok(balances(10, 5)));
    vi.mocked(client.setBalance).mockResolvedValue(ok({ leaveTypeId: "sick", days: 3 }));
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Adjust Sick leave balance for Ada Lovelace" }));
    const days = screen.getByLabelText("Days");
    await userEvent.clear(days);
    await userEvent.type(days, "3");
    await userEvent.click(screen.getByRole("button", { name: "Save balance" }));
    expect(await screen.findByText("3 days")).toBeInTheDocument();
    expect(screen.queryByText("5 days")).not.toBeInTheDocument();
    expect(screen.getByText("10 days")).toBeInTheDocument();
  });

  it.each(["-1", "2.5", ""])("rejects %p without calling the API", async (text) => {
    vi.mocked(client.listEmployees).mockResolvedValue(ok([ada]));
    vi.mocked(client.listBalances).mockResolvedValue(ok(balances(null, null)));
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Set Annual leave balance for Ada Lovelace" }));
    if (text) await userEvent.type(screen.getByLabelText("Days"), text);
    await userEvent.click(screen.getByRole("button", { name: "Save balance" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a whole number of days, 0 or more.");
    expect(client.setBalance).not.toHaveBeenCalled();
  });

  it("shows a refusal when forbidden (AC5)", async () => {
    vi.mocked(client.listEmployees).mockResolvedValue({ ok: false, reason: "forbidden", message: "" });
    render(<LeaveBalancesPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Change refused");
  });
});
