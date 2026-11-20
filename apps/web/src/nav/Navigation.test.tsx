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

  it("links the executive to the executive dashboard", () => {
    render(<Navigation role="read_only_executive" />);
    expect(screen.getByRole("link", { name: "Dashboards" })).toHaveAttribute("href", "/dashboards/executive");
  });

  it.each<Role>(["manager", "hr_admin"])("shows %s a plain Dashboards label", (role) => {
    render(<Navigation role={role} />);
    expect(screen.getByText("Dashboards")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Dashboards" })).toBeNull();
  });

  it("shows Dashboards for the read-only executive (AC12)", () => {
    render(<Navigation role="read_only_executive" />);
    expect(screen.getByText("Dashboards")).toBeInTheDocument();
  });
});
