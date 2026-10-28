import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as client from "./adminUsersClient";
import type { AdminUser } from "./adminUsersClient";
import { UsersAdminPage } from "./UsersAdminPage";

vi.mock("./adminUsersClient");

const priya: AdminUser = {
  id: "u1",
  email: "priya.shah@example.com",
  displayName: "Priya Shah",
  role: "employee",
  status: "active",
};
const tom: AdminUser = {
  id: "u2",
  email: "tom.reyes@example.com",
  displayName: "Tom Reyes",
  role: "manager",
  status: "deactivated",
};

const rowOf = (name: string) => screen.getByText(name).closest("li") as HTMLElement;

afterEach(() => vi.resetAllMocks());

describe("UsersAdminPage", () => {
  const load = async (users = [priya, tom]) => {
    vi.mocked(client.listUsers).mockResolvedValue(users);
    render(<UsersAdminPage />);
    await screen.findByText(users[0].displayName!);
  };

  it("lists the users with role and status (AC1)", async () => {
    await load();
    expect(screen.getByRole("heading", { name: "Users" })).toBeInTheDocument();
    expect(within(rowOf("Priya Shah")).getByText("Employee")).toBeInTheDocument();
    expect(within(rowOf("Priya Shah")).getByText("Active")).toBeInTheDocument();
    expect(within(rowOf("Tom Reyes")).getByText("Deactivated")).toBeInTheDocument();
    expect(screen.getByText("2 users")).toBeInTheDocument();
  });

  it("filters by search and offers to clear it", async () => {
    await load();
    await userEvent.type(screen.getByLabelText("Search users"), "zzz");
    expect(screen.getByText("No users match this search.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByText("Priya Shah")).toBeInTheDocument();
  });

  it("shows only the new role after a change (AC4)", async () => {
    await load();
    vi.mocked(client.changeRole).mockResolvedValue({ ok: true, user: { ...priya, role: "hr_admin" } });
    await userEvent.click(screen.getByRole("button", { name: "Change role for Priya Shah" }));
    await userEvent.click(screen.getByRole("radio", { name: /HR admin/i }));
    await userEvent.click(screen.getByRole("button", { name: "Save role" }));
    expect(client.changeRole).toHaveBeenCalledWith("u1", "hr_admin");
    const row = rowOf("Priya Shah");
    expect(await within(row).findByText("HR admin")).toBeInTheDocument();
    expect(within(row).queryByText("Employee")).toBeNull();
    expect(screen.getByText("Priya Shah is now HR admin.")).toBeInTheDocument();
  });

  it("deactivates after confirmation (AC6)", async () => {
    await load();
    vi.mocked(client.deactivateUser).mockResolvedValue({ ok: true, user: { ...priya, status: "deactivated" } });
    await userEvent.click(screen.getByRole("button", { name: "Deactivate Priya Shah" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Priya Shah will be signed out at once and cannot sign in until the account is reactivated.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    expect(await within(rowOf("Priya Shah")).findByText("Deactivated")).toBeInTheDocument();
    expect(screen.getByText("Priya Shah deactivated. Their session has ended.")).toBeInTheDocument();
  });

  it("reactivates at once (AC7)", async () => {
    await load();
    vi.mocked(client.reactivateUser).mockResolvedValue({ ok: true, user: { ...tom, status: "active" } });
    await userEvent.click(screen.getByRole("button", { name: "Reactivate Tom Reyes" }));
    expect(await within(rowOf("Tom Reyes")).findByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Tom Reyes reactivated. They can sign in again.")).toBeInTheDocument();
  });

  it("adds an invited joiner as pending with the chosen role (AC2)", async () => {
    await load();
    const joiner: AdminUser = {
      id: "u3",
      email: "new@example.com",
      displayName: "New Joiner",
      role: "manager",
      status: "pending",
    };
    vi.mocked(client.inviteUser).mockResolvedValue({ ok: true, user: joiner });
    await userEvent.click(screen.getByRole("button", { name: /Invite user/ }));
    await userEvent.type(screen.getByLabelText("Full name"), "New Joiner");
    await userEvent.type(screen.getByLabelText("Work email"), "new@example.com");
    await userEvent.selectOptions(screen.getByLabelText("Role"), "manager");
    await userEvent.click(screen.getByRole("button", { name: "Send invitation" }));
    const row = await screen.findByText("New Joiner").then((el) => el.closest("li") as HTMLElement);
    expect(within(row).getByText("Manager")).toBeInTheDocument();
    expect(within(row).getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Invitation sent to New Joiner as Manager.")).toBeInTheDocument();
  });
});
