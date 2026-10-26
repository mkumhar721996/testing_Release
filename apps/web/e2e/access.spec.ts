import { test, expect } from "@playwright/test";

const asRole = (role: string) => ({ user: { id: "u1", email: "ada@example.com", role } });

test("an HR admin sees the Admin section", async ({ page }) => {
  await page.route("**/auth/session", (r) => r.fulfill({ status: 200, json: asRole("hr_admin") }));
  await page.goto("/");
  await expect(page.getByRole("navigation").getByText("Admin")).toBeVisible();
});

test("an employee does not see the Admin section", async ({ page }) => {
  await page.route("**/auth/session", (r) => r.fulfill({ status: 200, json: asRole("employee") }));
  await page.goto("/");
  await expect(page.getByRole("navigation").getByText("Profile")).toBeVisible();
  await expect(page.getByRole("navigation").getByText("Admin")).toHaveCount(0);
});
