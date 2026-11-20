import { test, expect } from "@playwright/test";

const asRole = (role: string) => ({ user: { id: "u1", email: "ada@example.com", role } });

test("an executive sees headcount and leave totals", async ({ page }) => {
  await page.route("**/auth/session", (r) =>
    r.fulfill({ status: 200, json: asRole("read_only_executive") }),
  );
  await page.route("**/dashboards/executive", (r) =>
    r.fulfill({
      status: 200,
      json: {
        headcount: 248,
        leaveDaysTaken: 1312,
        leaveYear: { from: "2026-01-01", to: "2026-11-20" },
        hasData: true,
      },
    }),
  );
  await page.goto("/dashboards/executive");
  await expect(page.getByText("248")).toBeVisible();
  await expect(page.getByText("1,312 days")).toBeVisible();
});

test("a manager is told the dashboard is not available", async ({ page }) => {
  await page.route("**/auth/session", (r) => r.fulfill({ status: 200, json: asRole("manager") }));
  await page.goto("/dashboards/executive");
  await expect(page.getByText("The executive dashboard is not available to your role.")).toBeVisible();
  await expect(page.getByText("Total headcount")).toHaveCount(0);
});
