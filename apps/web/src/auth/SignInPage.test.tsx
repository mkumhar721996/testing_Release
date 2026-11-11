import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignInPage } from "./SignInPage";

const signIn = vi.fn();
vi.mock("./AuthProvider", () => ({ useAuth: () => ({ signIn }) }));

const GENERIC = "Incorrect email or password.";

describe("SignInPage", () => {
  it("shows an email field and a password field on load", () => {
    render(<SignInPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toHaveAttribute("type", "password");
  });

  it("links to the forgot-password page", () => {
    render(<SignInPage />);
    expect(screen.getByRole("link", { name: /forgot password\?/i })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });

  it("does not submit when the password is empty", async () => {
    signIn.mockReset();
    const user = userEvent.setup();
    render(<SignInPage />);
    await user.type(screen.getByLabelText(/email/i), "ada@example.com");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(signIn).not.toHaveBeenCalled();
  });

  it("submits valid credentials and shows no alert", async () => {
    signIn.mockReset();
    signIn.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SignInPage />);
    await user.type(screen.getByLabelText(/email/i), "ada@example.com");
    await user.type(screen.getByLabelText(/password/i), "test-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(signIn).toHaveBeenCalledWith("ada@example.com", "test-password");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the sign-in form on screen after a refused sign-in", async () => {
    signIn.mockResolvedValue({ ok: false, message: GENERIC });
    const user = userEvent.setup();
    render(<SignInPage />);
    await user.type(screen.getByLabelText(/email/i), "ada@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(GENERIC);
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
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
