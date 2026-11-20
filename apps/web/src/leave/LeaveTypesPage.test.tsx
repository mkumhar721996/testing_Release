import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeaveTypesPage } from "./LeaveTypesPage";
import * as client from "./leaveClient";

vi.mock("./leaveClient");

const annual = { id: "annual", name: "Annual leave", exempt: false, balanceCount: 2 };
const unpaid = { id: "unpaid", name: "Unpaid leave", exempt: false, balanceCount: 0 };

const ok = <T,>(value: T) => ({ ok: true as const, value });
const refused = (reason: "forbidden" | "conflict", code = "x") => ({
  ok: false as const,
  reason,
  code,
  message: "no",
});

beforeEach(() => vi.mocked(client.listLeaveTypes).mockResolvedValue(ok([annual, unpaid])));
afterEach(() => vi.resetAllMocks());

const rowOf = (name: string) => screen.getByRole("cell", { name }).closest("tr") as HTMLElement;

describe("LeaveTypesPage", () => {
  it("creates a leave type that appears in the list (AC1)", async () => {
    vi.mocked(client.createLeaveType).mockResolvedValue(
      ok({ id: "sick", name: "Sick leave", exempt: false, balanceCount: 0 }),
    );
    render(<LeaveTypesPage role="hr_admin" />);
    await userEvent.click(await screen.findByRole("button", { name: "New leave type" }));
    await userEvent.type(screen.getByLabelText("Name"), "Sick leave");
    await userEvent.click(screen.getByRole("button", { name: "Create leave type" }));
    expect(client.createLeaveType).toHaveBeenCalledWith({ name: "Sick leave", exempt: false });
    expect(await screen.findByRole("cell", { name: "Sick leave" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Sick leave created");
  });

  it("asks for a name instead of calling the API when it is blank", async () => {
    render(<LeaveTypesPage role="hr_admin" />);
    await userEvent.click(await screen.findByRole("button", { name: "New leave type" }));
    await userEvent.click(screen.getByRole("button", { name: "Create leave type" }));
    expect(
      screen.getByText("Enter a name for the leave type, for example Annual leave."),
    ).toBeInTheDocument();
    expect(client.createLeaveType).not.toHaveBeenCalled();
  });

  it("says when the name is already taken", async () => {
    vi.mocked(client.createLeaveType).mockResolvedValue(refused("conflict", "leave_type_name_taken"));
    render(<LeaveTypesPage role="hr_admin" />);
    await userEvent.click(await screen.findByRole("button", { name: "New leave type" }));
    await userEvent.type(screen.getByLabelText("Name"), "annual leave");
    await userEvent.click(screen.getByRole("button", { name: "Create leave type" }));
    expect(
      await screen.findByText("A leave type named annual leave already exists. Enter a different name."),
    ).toBeInTheDocument();
  });

  it("turns exempt on and off from the edit modal (AC6, AC7)", async () => {
    vi.mocked(client.updateLeaveType).mockImplementation(async (id, input) =>
      ok({ ...unpaid, id, ...input }),
    );
    render(<LeaveTypesPage role="hr_admin" />);
    await userEvent.click(await screen.findByRole("button", { name: "Edit Unpaid leave" }));
    await userEvent.click(screen.getByRole("switch", { name: "Exempt" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(client.updateLeaveType).toHaveBeenCalledWith("unpaid", {
      name: "Unpaid leave",
      exempt: true,
    });
    expect(await within(rowOf("Unpaid leave")).findByText("Exempt")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Edit Unpaid leave" }));
    await userEvent.click(screen.getByRole("switch", { name: "Exempt" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(client.updateLeaveType).toHaveBeenLastCalledWith("unpaid", {
      name: "Unpaid leave",
      exempt: false,
    });
    await screen.findByText("Unpaid leave saved");
    expect(within(rowOf("Unpaid leave")).queryByText("Exempt")).not.toBeInTheDocument();
    expect(within(rowOf("Unpaid leave")).getByText("No")).toBeInTheDocument();
  });

  it("shows a refusal and leaves the list unchanged for a non-HR user (AC5)", async () => {
    vi.mocked(client.createLeaveType).mockResolvedValue(refused("forbidden"));
    render(<LeaveTypesPage role="employee" />);
    expect(await screen.findByRole("button", { name: "Edit Annual leave" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete Annual leave" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "New leave type" }));
    await userEvent.type(screen.getByLabelText("Name"), "Study leave");
    await userEvent.click(screen.getByRole("button", { name: "Create leave type" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Change refused");
    expect(screen.queryByRole("cell", { name: "Study leave" })).toBeNull();
  });

  it("refuses to delete a type that has balances", async () => {
    vi.mocked(client.deleteLeaveType).mockResolvedValue(refused("conflict", "leave_type_in_use"));
    render(<LeaveTypesPage role="hr_admin" />);
    await userEvent.click(await screen.findByRole("button", { name: "Delete Annual leave" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete leave type" }));
    expect(
      await screen.findByText(/Deletion refused\. Annual leave has a balance for 2 employees\./),
    ).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Annual leave" })).toBeInTheDocument();
  });

  it("deletes an unused type", async () => {
    vi.mocked(client.deleteLeaveType).mockResolvedValue(ok(null));
    render(<LeaveTypesPage role="hr_admin" />);
    await userEvent.click(await screen.findByRole("button", { name: "Delete Unpaid leave" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete leave type" }));
    expect(client.deleteLeaveType).toHaveBeenCalledWith("unpaid");
    await screen.findByText("Unpaid leave deleted");
    expect(screen.queryByRole("cell", { name: "Unpaid leave" })).toBeNull();
  });

  it("shows the empty and error states", async () => {
    vi.mocked(client.listLeaveTypes).mockResolvedValueOnce(ok([]));
    const { unmount } = render(<LeaveTypesPage role="hr_admin" />);
    expect(await screen.findByText("No leave types yet")).toBeInTheDocument();
    unmount();
    vi.mocked(client.listLeaveTypes).mockResolvedValueOnce({
      ok: false,
      reason: "error",
      code: "x",
      message: "x",
    });
    render(<LeaveTypesPage role="hr_admin" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Leave types did not load.");
  });
});
