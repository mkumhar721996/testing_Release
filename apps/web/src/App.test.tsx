import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import * as client from "./auth/authClient";

vi.mock("./auth/authClient");

afterEach(() => vi.resetAllMocks());

describe("App", () => {
  it("shows the sign-in form when signed out", async () => {
    vi.mocked(client.getSession).mockResolvedValue(null);
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("logs the user in after valid credentials (AC1)", async () => {
    vi.mocked(client.getSession)
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ email: "ada@example.com" });
    vi.mocked(client.signIn).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText(/email/i), "ada@example.com");
    await user.type(screen.getByLabelText(/password/i), "test-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(client.signIn).toHaveBeenCalledWith("ada@example.com", "test-password");
  });

  it("does not log the user in on a wrong password (AC2)", async () => {
    vi.mocked(client.getSession).mockResolvedValue(null);
    vi.mocked(client.signIn).mockResolvedValue({
      ok: false,
      message: "Incorrect email or password.",
    });
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText(/email/i), "ada@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });

  it("shows the signed-in shell with a sign-out control", async () => {
    vi.mocked(client.getSession).mockResolvedValue({ email: "ada@example.com" });
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Web App" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
