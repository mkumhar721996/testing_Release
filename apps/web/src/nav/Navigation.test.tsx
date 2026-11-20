import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Role } from "../auth/authClient";
import { Navigation } from "./Navigation";

describe("Navigation", () => {
  it.each<Role>(["employee", "manager", "read_only_executive"])(
    "does not show Admin for %s (AC10)",
    (role) => {
      render(<Navigation role={role} />);
      expect(screen.queryByText("Admin")).toBeNull();
    },
  );

  it("shows Admin for an HR admin (AC11)", () => {
    render(<Navigation role="hr_admin" />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("links an HR admin to the employee records", () => {
    render(<Navigation role="hr_admin" />);
    expect(screen.getByRole("link", { name: "Employees" })).toHaveAttribute("href", "/employees");
  });

  it("links a manager's Team to their direct reports", () => {
    render(<Navigation role="manager" />);
    expect(screen.getByRole("link", { name: "Team" })).toHaveAttribute("href", "/direct-reports");
  });

  it("gives an employee no Team item", () => {
    render(<Navigation role="employee" />);
    expect(screen.queryByText("Team")).toBeNull();
  });

  it("shows Dashboards for the read-only executive (AC12)", () => {
    render(<Navigation role="read_only_executive" />);
    expect(screen.getByText("Dashboards")).toBeInTheDocument();
  });
});
