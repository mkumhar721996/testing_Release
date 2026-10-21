import { test, expect } from "@playwright/test";

test("renders the sign-in page when signed out", async ({ page }) => {
  await page.route("**/auth/session", (r) =>
    r.fulfill({ status: 401, json: { code: "session_expired" } }),
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
