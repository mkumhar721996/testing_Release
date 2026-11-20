import { test, expect } from "@playwright/test";

const hr = { user: { id: "u1", email: "hr@example.com", role: "hr_admin" } };

test("an HR admin sees Not set for a balance HR has not entered", async ({ page }) => {
  await page.route("**/auth/session", (r) => r.fulfill({ status: 200, json: hr }));
  await page.route("**/employees/options", (r) =>
    r.fulfill({
      status: 200,
      json: { departments: [], managers: [{ id: "e1", displayName: "Priya Raman", isExecutive: false }] },
    }),
  );
  await page.route("**/employees/e1/leave-balances", (r) =>
    r.fulfill({
      status: 200,
      json: [
        { leaveTypeId: "a", name: "Annual leave", exempt: false, days: 10 },
        { leaveTypeId: "s", name: "Sick leave", exempt: false, days: null },
      ],
    }),
  );
  await page.goto("/admin/leave-balances");
  await page.getByLabel("Employee").selectOption("e1");
  const sick = page.getByRole("row", { name: /Sick leave/ });
  await expect(sick.getByText("Not set")).toBeVisible();
  await expect(sick.getByText(/day/)).toHaveCount(0);
});

test("creating a leave type through the modal adds it to the table", async ({ page }) => {
  await page.route("**/auth/session", (r) => r.fulfill({ status: 200, json: hr }));
  const types: unknown[] = [{ id: "a", name: "Annual leave", exempt: false, balanceCount: 0 }];
  await page.route("**/leave-types", async (r) => {
    if (r.request().method() === "POST") {
      const body = r.request().postDataJSON();
      const created = { id: "n", ...body, balanceCount: 0 };
      types.push(created);
      return r.fulfill({ status: 201, json: created });
    }
    return r.fulfill({ status: 200, json: types });
  });
  await page.goto("/admin/leave-types");
  await page.getByRole("button", { name: "New leave type" }).click();
  await page.getByLabel("Name").fill("Study leave");
  await page.getByRole("button", { name: "Create leave type" }).click();
  await expect(page.getByRole("cell", { name: "Study leave" })).toBeVisible();
});
