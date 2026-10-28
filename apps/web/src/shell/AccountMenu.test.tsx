import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider } from "../auth/AuthProvider";
import * as client from "../auth/authClient";
import { AccountMenu } from "./AccountMenu";

vi.mock("../auth/authClient");

afterEach(() => vi.resetAllMocks());

async function renderMenu(email = "ada@example.com") {
  vi.mocked(client.getSession).mockResolvedValue({ email, role: "employee" });
  render(
    <AuthProvider>
      <AccountMenu />
    </AuthProvider>,
  );
  return screen.findByRole("button", { name: "Account" });
}

describe("AccountMenu", () => {
  it("shows the signed-in identity only once opened (AC4)", async () => {
    const user = userEvent.setup();
    await renderMenu();
    expect(screen.queryByText("ada@example.com")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Account" }));
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
  });

  it("signs out through the client (AC5)", async () => {
    vi.mocked(client.signOut).mockResolvedValue();
    const user = userEvent.setup();
    await renderMenu();
    await user.click(screen.getByRole("button", { name: "Account" }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(client.signOut).toHaveBeenCalledOnce();
  });

  it("opens and closes with Escape and outside click (E5)", async () => {
    const user = userEvent.setup();
    const button = await renderMenu();
    expect(button).toHaveAttribute("aria-expanded", "false");
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    await user.click(button);
    await user.click(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("swallows a failed sign-out request (E7)", async () => {
    vi.mocked(client.signOut).mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    await renderMenu();
    await user.click(screen.getByRole("button", { name: "Account" }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(client.signOut).toHaveBeenCalledOnce();
  });

  it("truncates a very long identity and exposes it via title (E8)", async () => {
    const long = `${"a".repeat(80)}@example.com`;
    const user = userEvent.setup();
    await renderMenu(long);
    await user.click(screen.getByRole("button", { name: "Account" }));
    expect(screen.getByText(long)).toHaveClass("truncate");
    expect(screen.getByText(long)).toHaveAttribute("title", long);
  });
});
