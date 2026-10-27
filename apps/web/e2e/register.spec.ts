import { test, expect } from "@playwright/test";

test("a signed-out visitor registers from the shopping page", async ({ page }) => {
  await page.route("**/auth/session", (r) => r.fulfill({ status: 401, json: {} }));
  await page.route("**/auth/register", (r) =>
    r.fulfill({ status: 201, json: { id: "u1", email: "ada@example.com" } }),
  );
  await page.goto("/shop");
  await page.getByRole("button", { name: /register/i }).click();
  await page.getByLabel(/email/i).fill("ada@example.com");
  await page.getByLabel(/password/i).fill("correct-horse-1");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page.getByText("Account created")).toBeVisible();
});
