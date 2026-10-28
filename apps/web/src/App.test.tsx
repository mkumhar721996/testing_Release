import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import * as client from "./auth/authClient";

import * as shopClient from "./shop/shopClient";

vi.mock("./auth/authClient");
vi.mock("./shop/shopClient");

afterEach(() => vi.resetAllMocks());

describe("App", () => {
  afterEach(() => window.history.pushState({}, "", "/"));

  it("renders the forgot-password page at /forgot-password", () => {
    window.history.pushState({}, "", "/forgot-password");
    render(<App />);
    expect(screen.getByRole("heading", { name: /forgot password/i })).toBeInTheDocument();
  });

  it("renders the reset page with the token from the link", async () => {
    vi.mocked(client.resetPassword).mockResolvedValue({ ok: true });
    window.history.pushState({}, "", "/reset-password?token=abc");
    render(<App />);
    await userEvent.type(screen.getByLabelText(/password/i), "new-password");
    await userEvent.click(screen.getByRole("button", { name: /reset password/i }));
    expect(client.resetPassword).toHaveBeenCalledWith("abc", "new-password");
  });
  it("shows the sign-in form when signed out", async () => {
    vi.mocked(client.getSession).mockResolvedValue(null);
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("renders the shopping page at /shop when signed in", async () => {
    vi.mocked(shopClient.listProducts).mockResolvedValue([]);
    vi.mocked(client.getSession).mockResolvedValue({ email: "ada@example.com", role: "employee" });
    window.history.pushState({}, "", "/shop");
    render(<App />);
    expect(await screen.findByRole("heading", { name: /shop/i })).toBeInTheDocument();
  });

  it("shows the shell and People when signed in, without the role-based nav", async () => {
    vi.mocked(client.getSession).mockResolvedValue({ email: "ada@example.com", role: "hr_admin" });
    render(<App />);
    expect(await screen.findByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "People" })).toBeInTheDocument();
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it.each(["/", "/nope", "/people/123"])("lands on People from %s (E2)", async (path) => {
    vi.mocked(client.getSession).mockResolvedValue({ email: "ada@example.com", role: "employee" });
    window.history.pushState({}, "", path);
    render(<App />);
    expect(await screen.findByRole("heading", { name: "People" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/people");
  });

  it("opens a deep link inside the same shell (E3)", async () => {
    vi.mocked(client.getSession).mockResolvedValue({ email: "ada@example.com", role: "employee" });
    window.history.pushState({}, "", "/leave");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Leave" })).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Leave" })).toHaveAttribute("aria-current", "page");
  });

  it("shows no shell while loading or signed out (E4)", async () => {
    vi.mocked(client.getSession).mockReturnValue(new Promise(() => {}));
    const { unmount } = render(<App />);
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    unmount();
    vi.mocked(client.getSession).mockResolvedValue(null);
    window.history.pushState({}, "", "/leave");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
  });

  it("signs out from a non-default screen (AC5, E6)", async () => {
    vi.mocked(client.getSession).mockResolvedValue({ email: "ada@example.com", role: "employee" });
    vi.mocked(client.signOut).mockResolvedValue();
    window.history.pushState({}, "", "/leave");
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Account" }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.queryByText("ada@example.com")).not.toBeInTheDocument();
  });

  it("signs out locally even when the request fails (E7)", async () => {
    vi.mocked(client.getSession).mockResolvedValue({ email: "ada@example.com", role: "employee" });
    vi.mocked(client.signOut).mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Account" }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });
});
