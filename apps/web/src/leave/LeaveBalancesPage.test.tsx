import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeaveBalancesPage } from "./LeaveBalancesPage";
import * as client from "./leaveClient";
import * as employees from "../employees/employeesClient";

vi.mock("./leaveClient");
vi.mock("../employees/employeesClient");

const ok = <T,>(value: T) => ({ ok: true as const, value });
const annual = { leaveTypeId: "annual", name: "Annual leave", exempt: false, days: null as number | null };
const sick = { leaveTypeId: "sick", name: "Sick leave", exempt: false, days: null as number | null };

beforeEach(() => {
  vi.mocked(employees.getEmployeeOptions).mockResolvedValue({
    departments: [],
    managers: [{ id: "e1", displayName: "Priya Raman", isExecutive: false }],
  });
  vi.mocked(client.listBalances).mockResolvedValue(ok([annual, sick]));
});
afterEach(() => vi.resetAllMocks());

const rowOf = (name: string) => screen.getByRole("cell", { name }).closest("tr") as HTMLElement;

async function choosePriya() {
  await userEvent.selectOptions(await screen.findByLabelText("Employee"), "e1");
}

async function save(button: string, days: string) {
  await userEvent.click(await screen.findByRole("button", { name: button }));
  const input = screen.getByRole("spinbutton");
  await userEvent.clear(input);
  if (days) await userEvent.type(input, days);
  await userEvent.click(screen.getByRole("button", { name: "Save balance" }));
}

describe("LeaveBalancesPage", () => {
  it("sets a balance (AC2) and then adjusts it (AC3)", async () => {
    vi.mocked(client.setBalance).mockImplementation(async (_e, id, days) =>
      ok({ leaveTypeId: id, days }),
    );
    render(<LeaveBalancesPage role="hr_admin" />);
    await choosePriya();
    await save("Set Annual leave balance for Priya Raman", "10");
    expect(client.setBalance).toHaveBeenCalledWith("e1", "annual", 10);
    expect(await screen.findByText("10 days")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Annual leave balance is now 10 days");

    await save("Adjust Annual leave balance for Priya Raman", "7");
    expect(await screen.findByText("7 days")).toBeInTheDocument();
    expect(screen.queryByText("10 days")).toBeNull();
  });

  it("changes only the adjusted type (AC4)", async () => {
    vi.mocked(client.listBalances).mockResolvedValue(
      ok([
        { ...annual, days: 10 },
        { ...sick, days: 5 },
      ]),
    );
    vi.mocked(client.setBalance).mockResolvedValue(ok({ leaveTypeId: "sick", days: 3 }));
    render(<LeaveBalancesPage role="hr_admin" />);
    await choosePriya();
    await save("Adjust Sick leave balance for Priya Raman", "3");
    expect(await within(rowOf("Sick leave")).findByText("3 days")).toBeInTheDocument();
    expect(within(rowOf("Annual leave")).getByText("10 days")).toBeInTheDocument();
  });

  it.each(["-1", "2.5", ""])("rejects %j without calling the API", async (value) => {
    render(<LeaveBalancesPage role="hr_admin" />);
    await choosePriya();
    await save("Set Annual leave balance for Priya Raman", value);
    expect(screen.getByText("Enter a whole number of days, 0 or more.")).toBeInTheDocument();
    expect(client.setBalance).not.toHaveBeenCalled();
  });

  it("shows 'Not set' with no days figure, distinct from 0 (AC11)", async () => {
    vi.mocked(client.listBalances).mockResolvedValue(ok([{ ...annual, days: 0 }, sick]));
    render(<LeaveBalancesPage role="hr_admin" />);
    await choosePriya();
    await screen.findByText("Not set");
    expect(within(rowOf("Sick leave")).queryByText(/day/)).not.toBeInTheDocument();
    expect(within(rowOf("Annual leave")).getByText("0 days")).toBeInTheDocument();
  });

  it("writes 1 day in the singular and 0 days as a real balance", async () => {
    vi.mocked(client.setBalance).mockImplementation(async (_e, id, days) =>
      ok({ leaveTypeId: id, days }),
    );
    render(<LeaveBalancesPage role="hr_admin" />);
    await choosePriya();
    await save("Set Annual leave balance for Priya Raman", "1");
    expect(await screen.findByText("1 day")).toBeInTheDocument();
    await save("Set Sick leave balance for Priya Raman", "0");
    expect(await within(rowOf("Sick leave")).findByText("0 days")).toBeInTheDocument();
    expect(client.setBalance).toHaveBeenLastCalledWith("e1", "sick", 0);
  });

  it("keeps the balance unchanged when the API rejects the days", async () => {
    vi.mocked(client.setBalance).mockResolvedValue({
      ok: false,
      reason: "invalid",
      code: "balance_invalid",
      message: "x",
    });
    render(<LeaveBalancesPage role="hr_admin" />);
    await choosePriya();
    await save("Set Annual leave balance for Priya Raman", "5");
    expect(await screen.findByText("Enter a whole number of days, 0 or more.")).toBeInTheDocument();
    expect(within(rowOf("Annual leave")).getByText("Not set")).toBeInTheDocument();
  });

  it("offers a way back to leave types when none exist", async () => {
    vi.mocked(client.listBalances).mockResolvedValue(ok([]));
    render(<LeaveBalancesPage role="hr_admin" />);
    await choosePriya();
    expect(await screen.findByText("No leave types to set balances for")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to leave types" })).toHaveAttribute(
      "href",
      "/admin/leave-types",
    );
  });

  it("shows a refusal when the API says forbidden (AC5)", async () => {
    vi.mocked(client.setBalance).mockResolvedValue({
      ok: false,
      reason: "forbidden",
      code: "x",
      message: "x",
    });
    render(<LeaveBalancesPage role="employee" />);
    await choosePriya();
    await save("Set Annual leave balance for Priya Raman", "99");
    expect(await screen.findByRole("alert")).toHaveTextContent("Change refused. Your role is employee.");
    expect(screen.queryByText("99 days")).toBeNull();
  });
});
