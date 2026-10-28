import { describe, expect, it } from "vitest";
import type { Role } from "../auth/authClient";
import { navigationFor } from "./navigation";

describe("navigationFor", () => {
  it.each<Role>(["employee", "manager", "read_only_executive"])(
    "does not list Admin for %s (AC10)",
    (role) => {
      expect(navigationFor(role)).not.toContain("admin");
    },
  );

  it("lists Admin for an HR admin (AC11)", () => {
    expect(navigationFor("hr_admin")).toContain("admin");
  });

  it("lists dashboards for the read-only executive (AC12)", () => {
    expect(navigationFor("read_only_executive")).toContain("dashboards");
  });

  it("gives every role own profile and leave", () => {
    for (const role of ["employee", "manager", "hr_admin", "read_only_executive"] as Role[]) {
      expect(navigationFor(role)).toEqual(expect.arrayContaining(["profile", "leave"]));
    }
  });

  it("hides dashboards from employees and the team from non-managers", () => {
    expect(navigationFor("employee")).not.toContain("dashboards");
    expect(navigationFor("manager")).toContain("team");
    expect(navigationFor("hr_admin")).not.toContain("team");
  });
});
