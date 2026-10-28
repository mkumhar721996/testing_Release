import { test, expect } from "@playwright/test";

const asRole = (role: string) => ({ user: { id: "u1", email: "ada@example.com", role } });

for (const role of ["hr_admin", "employee"]) {
  test(`a ${role} sees People and Leave in the main navigation`, async ({ page }) => {
    await page.route("**/auth/session", (r) => r.fulfill({ status: 200, json: asRole(role) }));
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "People" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Leave" })).toBeVisible();
  });
}
