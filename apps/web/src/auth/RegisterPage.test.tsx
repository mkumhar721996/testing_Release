import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegisterPage } from "./RegisterPage";
import * as client from "./authClient";

vi.mock("./authClient");

afterEach(() => vi.resetAllMocks());

describe("RegisterPage", () => {
  it("creates an account from the entered details", async () => {
    vi.mocked(client.register).mockResolvedValue({ ok: true });
    render(<RegisterPage />);
    await userEvent.type(screen.getByLabelText(/email/i), "new@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "test-password");
    await userEvent.click(screen.getByRole("button", { name: "Register" }));
    expect(client.register).toHaveBeenCalledWith("new@example.com", "test-password");
    expect(await screen.findByRole("status")).toHaveTextContent("Account created");
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/");
  });

  it("shows the server message when registration fails", async () => {
    vi.mocked(client.register).mockResolvedValue({
      ok: false,
      code: "email_already_registered",
      message: "Already registered.",
    });
    render(<RegisterPage />);
    await userEvent.type(screen.getByLabelText(/email/i), "new@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "test-password");
    await userEvent.click(screen.getByRole("button", { name: "Register" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Already registered.");
  });

  it("does not submit when the password is empty", async () => {
    render(<RegisterPage />);
    await userEvent.type(screen.getByLabelText(/email/i), "new@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Register" }));
    expect(client.register).not.toHaveBeenCalled();
  });
});
