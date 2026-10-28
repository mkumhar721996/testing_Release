import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import * as client from "./auth/authClient";

import * as shopClient from "./shop/shopClient";

vi.mock("./auth/authClient");
import * as adminClient from "./admin/adminUsersClient";

vi.mock("./shop/shopClient");
vi.mock("./admin/adminUsersClient");

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
    vi.mocked(client.getSession).mockResolvedValue({ email: "ada@example.com" });
    render(<App />);
    expect(await screen.findByText("Signed in as ada@example.com")).toBeInTheDocument();
  });

  it("renders the shopping page at /shop when signed in", async () => {
    vi.mocked(shopClient.listProducts).mockResolvedValue([]);
    vi.mocked(client.getSession).mockResolvedValue({ email: "ada@example.com" });
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
    expect(screen.getByRole("link", { name: "Users" })).toHaveAttribute("href", "/admin/users");
  });

  it("renders the user list at /admin/users for an HR admin", async () => {
    vi.mocked(adminClient.listUsers).mockResolvedValue([]);
    vi.mocked(client.getSession).mockResolvedValue({ email: "hr@example.com", role: "hr_admin" });
    window.history.pushState({}, "", "/admin/users");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Users" })).toBeInTheDocument();
    expect(adminClient.listUsers).toHaveBeenCalled();
  });

  it.each(["employee", "manager", "read_only_executive"] as const)(
    "shows %s the restricted card and never calls the API (AC8)",
    async (role) => {
      vi.mocked(client.getSession).mockResolvedValue({ email: "x@example.com", role });
      window.history.pushState({}, "", "/admin/users");
      render(<App />);
      expect(await screen.findByText("This page is available to HR admins only.")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Users" })).toBeNull();
      expect(adminClient.listUsers).not.toHaveBeenCalled();
    },
  );
});
