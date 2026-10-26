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

  it("shows Dashboards for the read-only executive (AC12)", () => {
    render(<Navigation role="read_only_executive" />);
    expect(screen.getByText("Dashboards")).toBeInTheDocument();
  });
});
