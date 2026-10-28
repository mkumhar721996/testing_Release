import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InviteUserModal } from "./InviteUserModal";

const setup = (onSend = vi.fn().mockResolvedValue(undefined)) => {
  render(<InviteUserModal onSend={onSend} onCancel={() => {}} />);
  return onSend;
};

describe("InviteUserModal", () => {
  it("offers a placeholder and exactly the four roles (AC3)", () => {
    setup();
    const options = screen.getAllByRole("option") as HTMLOptionElement[];
    expect(options.map((o) => o.value)).toEqual([
      "",
      "employee",
      "manager",
      "hr_admin",
      "read_only_executive",
    ]);
  });

  it("shows the role error and sends nothing without a role (AC11)", async () => {
    const onSend = setup();
    await userEvent.type(screen.getByLabelText("Full name"), "New Joiner");
    await userEvent.type(screen.getByLabelText("Work email"), "new@example.com");
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a role to send the invitation.");
    await userEvent.click(screen.getByRole("button", { name: "Send invitation" }));
    expect(onSend).not.toHaveBeenCalled();
  });

  it("sends the trimmed details with the selected role (AC2)", async () => {
    const onSend = setup();
    await userEvent.type(screen.getByLabelText("Full name"), " New Joiner ");
    await userEvent.type(screen.getByLabelText("Work email"), "new@example.com");
    await userEvent.selectOptions(screen.getByLabelText("Role"), "manager");
    await userEvent.click(screen.getByRole("button", { name: "Send invitation" }));
    expect(onSend).toHaveBeenCalledWith({
      displayName: "New Joiner",
      email: "new@example.com",
      role: "manager",
    });
  });
});
