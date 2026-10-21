import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignInPage } from "./SignInPage";

const signIn = vi.fn();
vi.mock("./AuthProvider", () => ({ useAuth: () => ({ signIn }) }));

const GENERIC = "Incorrect email or password.";

describe("SignInPage", () => {
  it("shows the server's generic message verbatim and does not echo the email (AC7)", async () => {
    signIn.mockResolvedValue({ ok: false, message: GENERIC });
    const user = userEvent.setup();
    render(<SignInPage />);
    await user.type(screen.getByLabelText(/email/i), "ada@example.com");
    await user.type(screen.getByLabelText(/password/i), "test-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(GENERIC);
    expect(screen.queryByText("ada@example.com")).toBeNull();
    expect(signIn).toHaveBeenCalledWith("ada@example.com", "test-password");
  });
});
