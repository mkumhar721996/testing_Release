import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import * as client from "./auth/authClient";

import * as shopClient from "./shop/shopClient";

import * as leaveClient from "./leave/leaveClient";

vi.mock("./leave/leaveClient");
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

  it("shows who is signed in", async () => {
    vi.mocked(client.getSession).mockResolvedValue({ email: "ada@example.com", role: "employee" });
    render(<App />);
    expect(await screen.findByText("Signed in as ada@example.com")).toBeInTheDocument();
  });

  it("renders the shopping page at /shop when signed in", async () => {
    vi.mocked(shopClient.listProducts).mockResolvedValue([]);
    vi.mocked(client.getSession).mockResolvedValue({ email: "ada@example.com", role: "employee" });
    window.history.pushState({}, "", "/shop");
    render(<App />);
    expect(await screen.findByRole("heading", { name: /shop/i })).toBeInTheDocument();
  });

  it("shows the signed-in shell with a sign-out control", async () => {
    vi.mocked(client.getSession).mockResolvedValue({ email: "ada@example.com", role: "employee" });
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Web App" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("lists Admin in the navigation only for an HR admin (AC10, AC11)", async () => {
    vi.mocked(client.getSession).mockResolvedValue({ email: "hr@example.com", role: "hr_admin" });
    render(<App />);
    expect(await screen.findByText("Admin")).toBeInTheDocument();
  });

  it("links HR admins, and only them, to leave types from the home screen", async () => {
    vi.mocked(client.getSession).mockResolvedValue({ email: "hr@example.com", role: "hr_admin" });
    const { unmount } = render(<App />);
    expect(await screen.findByRole("link", { name: "Leave types" })).toHaveAttribute(
      "href",
      "/admin/leave-types",
    );
    unmount();
    vi.mocked(client.getSession).mockResolvedValue({ email: "ada@example.com", role: "employee" });
    render(<App />);
    await screen.findByText("Signed in as ada@example.com");
    expect(screen.queryByRole("link", { name: "Leave types" })).toBeNull();
  });

  it("renders the leave types page at /admin/leave-types", async () => {
    vi.mocked(leaveClient.listLeaveTypes).mockResolvedValue({ ok: true, value: [] });
    vi.mocked(client.getSession).mockResolvedValue({ email: "hr@example.com", role: "hr_admin" });
    window.history.pushState({}, "", "/admin/leave-types");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Leave types" })).toBeInTheDocument();
  });
});
