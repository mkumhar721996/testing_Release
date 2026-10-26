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

  it("shows the signed-in shell with a sign-out control", async () => {
    vi.mocked(client.getSession).mockResolvedValue({ email: "ada@example.com" });
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Web App" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("signs the user in after submitting valid credentials", async () => {
    vi.mocked(client.getSession)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ email: "ada@example.com" });
    vi.mocked(client.signIn).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText(/email/i), "ada@example.com");
    await user.type(screen.getByLabelText(/password/i), "test-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(client.signIn).toHaveBeenCalledWith("ada@example.com", "test-password");
    expect(await screen.findByText("Signed in as ada@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
