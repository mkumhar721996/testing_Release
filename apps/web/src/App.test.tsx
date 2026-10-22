import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";
import * as client from "./auth/authClient";
import * as employees from "./employees/employeesClient";

vi.mock("./auth/authClient");
vi.mock("./employees/employeesClient");

afterEach(() => vi.resetAllMocks());

describe("App", () => {
  it("shows the sign-in form when signed out", async () => {
    vi.mocked(client.getSession).mockResolvedValue(null);
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows the signed-in shell hosting the directory, with a sign-out control", async () => {
    vi.mocked(client.getSession).mockResolvedValue({ email: "ada@example.com", role: "manager" });
    vi.mocked(employees.listEmployees).mockResolvedValue({
      employees: [],
      counts: { all: 0, active: 0, on_leave: 0, inactive: 0 },
      total: 0,
    });
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Employees" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Records" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
