import { test, expect, type Page } from "@playwright/test";

const signInAs = (page: Page, role: string) =>
  page.route("**/auth/session", (r) =>
    r.fulfill({ status: 200, json: { user: { id: "u1", email: "u@example.com", role } } }),
  );

const summary = {
  asOf: "2026-11-20",
  leaversSince: "2025-11-20",
  headcount: 184,
  leavers12m: 9,
  leaveDays: 412,
  headcountByDepartment: [{ department: "Engineering", count: 184 }],
  leaveByType: [{ kind: "annual", days: 412 }],
};

test("an HR admin sees company-wide headcount and leave", async ({ page }) => {
  await signInAs(page, "hr_admin");
  await page.route("**/dashboards/hr-admin", (r) => r.fulfill({ status: 200, json: summary }));
  await page.goto("/dashboard");
  await expect(page.getByText("Current headcount")).toBeVisible();
  await expect(page.getByText("412 days").first()).toBeVisible();
});

test("an HR admin sees an empty state and can refresh", async ({ page }) => {
  await signInAs(page, "hr_admin");
  let calls = 0;
  await page.route("**/dashboards/hr-admin", (r) => {
    calls += 1;
    const body =
      calls === 1
        ? { ...summary, headcount: 0, leavers12m: 0, leaveDays: 0, headcountByDepartment: [], leaveByType: [] }
        : summary;
    return r.fulfill({ status: 200, json: body });
  });
  await page.goto("/dashboard");
  await expect(page.getByText("No headcount or leave data matches this dashboard yet.")).toBeVisible();
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.getByText("Current headcount")).toBeVisible();
});

test("an employee is told they have no access and sees no figures", async ({ page }) => {
  await signInAs(page, "employee");
  await page.goto("/dashboard");
  await expect(page.getByRole("alert")).toContainText("You do not have access");
  await expect(page.getByText("Current headcount")).toHaveCount(0);
});
