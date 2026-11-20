import { test, expect } from "@playwright/test";

const hrSession = { user: { id: "u1", email: "hr@example.com", role: "hr_admin" } };

test("an HR admin sees Sick leave as not set, with no days figure", async ({ page }) => {
  await page.route("**/auth/session", (r) => r.fulfill({ status: 200, json: hrSession }));
  await page.route("**/employees", (r) =>
    r.fulfill({ status: 200, json: [{ id: "e1", displayName: "Ada Lovelace" }] }),
  );
  await page.route("**/employees/e1/leave-balances", (r) =>
    r.fulfill({
      status: 200,
      json: [
        { leaveTypeId: "annual", name: "Annual leave", exempt: false, days: 10 },
        { leaveTypeId: "sick", name: "Sick leave", exempt: false, days: null },
      ],
    }),
  );
  await page.goto("/admin/leave-balances");
  await page.getByLabel("Employee").selectOption("e1");
  const row = page.getByRole("row", { name: /Sick leave/ });
  await expect(row.getByText("Not set")).toBeVisible();
  await expect(row.getByText(/day/)).toHaveCount(0);
});

test("an HR admin creates a leave type through the modal", async ({ page }) => {
  await page.route("**/auth/session", (r) => r.fulfill({ status: 200, json: hrSession }));
  await page.route("**/leave-types", (r) => {
    if (r.request().method() === "POST") {
      return r.fulfill({
        status: 201,
        json: { id: "n", name: "Study leave", exempt: false },
      });
    }
    return r.fulfill({ status: 200, json: [] });
  });
  await page.goto("/admin/leave-types");
  await page.getByRole("button", { name: "New leave type" }).click();
  await page.getByLabel("Name").fill("Study leave");
  await page.getByRole("button", { name: "Create leave type" }).click();
  await expect(page.getByRole("cell", { name: "Study leave" })).toBeVisible();
});
