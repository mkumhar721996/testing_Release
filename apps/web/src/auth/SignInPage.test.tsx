import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignInPage } from "./SignInPage";

const signIn = vi.fn();
vi.mock("./AuthProvider", () => ({ useAuth: () => ({ signIn }) }));

const GENERIC = "Incorrect email or password.";

describe("SignInPage", () => {
  it("shows a username field and a password field (AC3)", () => {
    render(<SignInPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("clears the password after a refused sign-in (AC2)", async () => {
    signIn.mockResolvedValue({ ok: false, message: GENERIC });
    const user = userEvent.setup();
    render(<SignInPage />);
    await user.type(screen.getByLabelText(/email/i), "ada@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(GENERIC);
    expect(screen.getByLabelText(/password/i)).toHaveValue("");
  });

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
});
