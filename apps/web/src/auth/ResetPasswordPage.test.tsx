import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResetPasswordPage } from "./ResetPasswordPage";
import * as client from "./authClient";

vi.mock("./authClient");

async function submit() {
  const user = userEvent.setup();
  render(<ResetPasswordPage token="t" />);
  await user.type(screen.getByLabelText(/new password/i), "test-password");
  await user.click(screen.getByRole("button", { name: /reset password/i }));
}

describe("ResetPasswordPage", () => {
  it("resets the password and links back to sign in (AC1)", async () => {
    vi.mocked(client.resetPassword).mockResolvedValue({ ok: true });
    await submit();
    expect(await screen.findByRole("link", { name: /sign in/i })).toBeInTheDocument();
    expect(client.resetPassword).toHaveBeenCalledWith("t", "test-password");
  });

  it.each([
    ["password_reset_link_expired", "This password reset link has expired. Request a new one."],
    ["password_policy", "That password does not meet the password requirements."],
  ])("shows the %s message in an alert", async (code, message) => {
    vi.mocked(client.resetPassword).mockResolvedValue({ ok: false, code, message });
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });
});
