import { test, expect } from "@playwright/test";

test("the shell navigates between screens and signs out", async ({ page }) => {
  await page.route("**/auth/session", (r) =>
    r.fulfill({
      status: 200,
      json: { user: { id: "u1", email: "ada@example.com", role: "employee" } },
    }),
  );
  await page.route("**/auth/sign-out", (r) => r.fulfill({ status: 204 }));
  await page.goto("/leave");
  await expect(page.getByRole("heading", { name: "Leave" })).toBeVisible();
  await page.getByRole("link", { name: "People" }).click();
  await expect(page).toHaveURL(/\/people$/);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Leave" })).toBeVisible();
  await page.getByRole("button", { name: "Account" }).click();
  await expect(page.getByText("ada@example.com")).toBeVisible();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
