import { test, expect } from "@playwright/test";

const GENERIC = "Incorrect email or password.";

test("a refused sign-in shows only the generic message", async ({ page }) => {
  await page.route("**/auth/session", (r) =>
    r.fulfill({ status: 401, json: { code: "session_expired" } }),
  );
  await page.route("**/auth/sign-in", (r) =>
    r.fulfill({ status: 401, json: { message: GENERIC } }),
  );
  await page.goto("/");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Password").fill("test-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toHaveText(GENERIC);
});

test("an expired activation link asks for a new email", async ({ page }) => {
  await page.route("**/auth/activate", (r) =>
    r.fulfill({
      status: 410,
      json: {
        code: "activation_link_expired",
        message: "This activation link has expired. Request a new activation email.",
      },
    }),
  );
  await page.goto("/activate?token=abc");
  await page.getByLabel("Password").fill("test-password");
  await page.getByRole("button", { name: "Activate account" }).click();
  await expect(page.getByRole("alert")).toContainText("Request a new activation email");
});
