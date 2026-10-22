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

  it("shows email and password fields when signed out (AC5)", async () => {
    vi.mocked(client.getSession).mockResolvedValue(null);
    render(<App />);
    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("shows the sign-in screen after choosing sign out (AC4)", async () => {
    vi.mocked(client.getSession).mockResolvedValue({ email: "ada@example.com" });
    vi.mocked(client.signOut).mockResolvedValue();
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Web App" })).not.toBeInTheDocument();
  });

  it.each(["/people", "/leave", "/people/123"])(
    "shows only sign-in at %s when signed out (AC6)",
    async (path) => {
      window.history.pushState({}, "", path);
      vi.mocked(client.getSession).mockResolvedValue(null);
      render(<App />);
      expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Web App" })).not.toBeInTheDocument();
      expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument();
      window.history.pushState({}, "", "/");
    },
  );

  it("offers no account creation on the sign-in screen (AC7)", async () => {
    vi.mocked(client.getSession).mockResolvedValue(null);
    render(<App />);
    await screen.findByRole("heading", { name: "Sign in" });
    const re = /sign up|register|create (an )?account/i;
    expect(screen.queryByRole("link", { name: re })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: re })).not.toBeInTheDocument();
  });
});
