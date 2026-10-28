import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResetPasswordPage } from "./ResetPasswordPage";
import * as client from "./authClient";

vi.mock("./authClient");

describe("ResetPasswordPage", () => {
  it("resets the password and links back to sign in", async () => {
    vi.mocked(client.resetPassword).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ResetPasswordPage token="t" />);
    await user.type(screen.getByLabelText(/password/i), "new-password");
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    expect(client.resetPassword).toHaveBeenCalledWith("t", "new-password");
    expect(await screen.findByRole("link", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows the server message on failure", async () => {
    vi.mocked(client.resetPassword).mockResolvedValue({
      ok: false,
      code: "password_reset_link_expired",
      message: "This password reset link has expired. Request a new one.",
    });
    const user = userEvent.setup();
    render(<ResetPasswordPage token="t" />);
    await user.type(screen.getByLabelText(/password/i), "new-password");
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/has expired/i);
  });
});
