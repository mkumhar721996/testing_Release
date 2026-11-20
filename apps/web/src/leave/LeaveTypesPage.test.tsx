import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeaveTypesPage } from "./LeaveTypesPage";
import * as client from "./leaveClient";

vi.mock("./leaveClient");

afterEach(() => vi.resetAllMocks());

const annual = { id: "annual", name: "Annual leave", exempt: false, balanceCount: 2 };
const unpaid = { id: "unpaid", name: "Unpaid leave", exempt: false, balanceCount: 0 };
const ok = <T,>(value: T) => ({ ok: true as const, value });

const rowOf = (name: string) => screen.getByRole("cell", { name }).closest("tr") as HTMLElement;

describe("LeaveTypesPage", () => {
  it("creates a leave type that appears in the list (AC1)", async () => {
    vi.mocked(client.listLeaveTypes).mockResolvedValue(ok([]));
    vi.mocked(client.createLeaveType).mockResolvedValue(ok({ id: "n", name: "Annual leave", exempt: false, balanceCount: 0 }));
    render(<LeaveTypesPage />);
    await userEvent.click(await screen.findByRole("button", { name: "New leave type" }));
    await userEvent.type(screen.getByLabelText("Name"), "Annual leave");
    await userEvent.click(screen.getByRole("button", { name: "Create leave type" }));
    expect(client.createLeaveType).toHaveBeenCalledWith({ name: "Annual leave", exempt: false });
    expect(await screen.findByRole("cell", { name: "Annual leave" })).toBeInTheDocument();
  });

  it("refuses a blank name without calling the API", async () => {
    vi.mocked(client.listLeaveTypes).mockResolvedValue(ok([annual]));
    render(<LeaveTypesPage />);
    await userEvent.click(await screen.findByRole("button", { name: "New leave type" }));
    await userEvent.click(screen.getByRole("button", { name: "Create leave type" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a name for the leave type, for example Annual leave.",
    );
    expect(client.createLeaveType).not.toHaveBeenCalled();
  });

  it("shows the duplicate-name copy on a conflict", async () => {
    vi.mocked(client.listLeaveTypes).mockResolvedValue(ok([annual]));
    vi.mocked(client.createLeaveType).mockResolvedValue({ ok: false, reason: "conflict", message: "" });
    render(<LeaveTypesPage />);
    await userEvent.click(await screen.findByRole("button", { name: "New leave type" }));
    await userEvent.type(screen.getByLabelText("Name"), "annual leave");
    await userEvent.click(screen.getByRole("button", { name: "Create leave type" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A leave type named annual leave already exists. Enter a different name.",
    );
  });

  it("turns the exempt setting on (AC6) and off (AC7)", async () => {
    vi.mocked(client.listLeaveTypes).mockResolvedValue(ok([unpaid]));
    vi.mocked(client.updateLeaveType)
      .mockResolvedValueOnce(ok({ ...unpaid, exempt: true }))
      .mockResolvedValueOnce(ok(unpaid));
    render(<LeaveTypesPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Edit Unpaid leave" }));
    await userEvent.click(screen.getByRole("switch", { name: "Exempt" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(client.updateLeaveType).toHaveBeenLastCalledWith("unpaid", { name: "Unpaid leave", exempt: true });
    expect(await within(rowOf("Unpaid leave")).findByText("Exempt")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Edit Unpaid leave" }));
    await userEvent.click(screen.getByRole("switch", { name: "Exempt" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(client.updateLeaveType).toHaveBeenLastCalledWith("unpaid", { name: "Unpaid leave", exempt: false });
    expect(await within(rowOf("Unpaid leave")).findByText("No")).toBeInTheDocument();
    expect(within(rowOf("Unpaid leave")).queryByText("Exempt")).not.toBeInTheDocument();
  });

  it("renames a leave type (AC8)", async () => {
    vi.mocked(client.listLeaveTypes).mockResolvedValue(ok([annual]));
    vi.mocked(client.updateLeaveType).mockResolvedValue(ok({ ...annual, name: "Annual holiday" }));
    render(<LeaveTypesPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Edit Annual leave" }));
    const name = screen.getByLabelText("Name");
    expect(name).toHaveValue("Annual leave");
    await userEvent.clear(name);
    await userEvent.type(name, "Annual holiday");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("cell", { name: "Annual holiday" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "Annual leave" })).not.toBeInTheDocument();
  });

  it("deletes an unused leave type (AC9)", async () => {
    vi.mocked(client.listLeaveTypes).mockResolvedValue(ok([unpaid]));
    vi.mocked(client.deleteLeaveType).mockResolvedValue(ok(null));
    render(<LeaveTypesPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Delete Unpaid leave" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete leave type" }));
    expect(client.deleteLeaveType).toHaveBeenCalledWith("unpaid");
    await vi.waitFor(() =>
      expect(screen.queryByRole("cell", { name: "Unpaid leave" })).not.toBeInTheDocument(),
    );
  });

  it("keeps a leave type that has balances when deletion is refused (AC10)", async () => {
    vi.mocked(client.listLeaveTypes).mockResolvedValue(ok([annual]));
    vi.mocked(client.deleteLeaveType).mockResolvedValue({ ok: false, reason: "conflict", message: "" });
    render(<LeaveTypesPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Delete Annual leave" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete leave type" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Deletion refused. Annual leave has a balance for 2 employees.",
    );
    expect(screen.getByRole("cell", { name: "Annual leave" })).toBeInTheDocument();
  });

  it("shows a refusal and leaves the list unchanged when forbidden (AC5)", async () => {
    vi.mocked(client.listLeaveTypes).mockResolvedValue(ok([annual]));
    vi.mocked(client.createLeaveType).mockResolvedValue({ ok: false, reason: "forbidden", message: "" });
    render(<LeaveTypesPage />);
    await userEvent.click(await screen.findByRole("button", { name: "New leave type" }));
    await userEvent.type(screen.getByLabelText("Name"), "Study leave");
    await userEvent.click(screen.getByRole("button", { name: "Create leave type" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Change refused");
    expect(screen.queryByRole("cell", { name: "Study leave" })).not.toBeInTheDocument();
  });

  it("shows an empty state and an error state with retry", async () => {
    vi.mocked(client.listLeaveTypes)
      .mockResolvedValueOnce({ ok: false, reason: "error", message: "" })
      .mockResolvedValueOnce(ok([]));
    render(<LeaveTypesPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load leave types");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No leave types yet")).toBeInTheDocument();
  });
});
