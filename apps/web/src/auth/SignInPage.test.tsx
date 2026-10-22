import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignInPage } from "./SignInPage";

const signIn = vi.fn();
vi.mock("./AuthProvider", () => ({ useAuth: () => ({ signIn }) }));

const GENERIC = "Incorrect email or password.";

describe("SignInPage", () => {
  it("shows exactly the server's generic message and nothing else in the alert (AC7)", async () => {
    signIn.mockResolvedValue({ ok: false, message: GENERIC });
    const user = userEvent.setup();
    render(<SignInPage />);
    await user.type(screen.getByLabelText(/email/i), "ada@example.com");
    await user.type(screen.getByLabelText(/password/i), "test-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(GENERIC);
    expect(signIn).toHaveBeenCalledWith("ada@example.com", "test-password");
  });

  it("clears the password and keeps the email after a refusal (AC2)", async () => {
    signIn.mockResolvedValue({ ok: false, message: GENERIC });
    const user = userEvent.setup();
    render(<SignInPage />);
    await user.type(screen.getByLabelText(/email/i), "ada@example.com");
    await user.type(screen.getByLabelText(/password/i), "test-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText(/email/i)).toHaveValue("ada@example.com");
    expect(screen.getByLabelText(/password/i)).toHaveValue("");
  });
});
