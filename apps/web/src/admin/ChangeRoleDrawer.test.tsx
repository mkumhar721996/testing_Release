import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChangeRoleDrawer } from "./ChangeRoleDrawer";

const user = {
  id: "u1",
  email: "priya@example.com",
  displayName: "Priya Shah",
  role: "employee" as const,
  status: "active" as const,
};

describe("ChangeRoleDrawer", () => {
  it("renders exactly four radios, with the current role preselected (AC3)", () => {
    render(<ChangeRoleDrawer user={user} onSave={vi.fn()} onCancel={() => {}} />);
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios.map((r) => r.value)).toEqual([
      "employee",
      "manager",
      "hr_admin",
      "read_only_executive",
    ]);
    expect(radios.filter((r) => r.checked).map((r) => r.value)).toEqual(["employee"]);
  });

  it("allows one role only (AC5)", async () => {
    render(<ChangeRoleDrawer user={user} onSave={vi.fn()} onCancel={() => {}} />);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    await userEvent.click(screen.getByRole("radio", { name: /manager/i }));
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios.filter((r) => r.checked)).toHaveLength(1);
  });

  it("saves the chosen role (AC4)", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ChangeRoleDrawer user={user} onSave={onSave} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("radio", { name: /HR admin/i }));
    await userEvent.click(screen.getByRole("button", { name: "Save role" }));
    expect(onSave).toHaveBeenCalledWith("hr_admin");
  });
});
