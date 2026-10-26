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
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
});

test("a valid sign-in shows the signed-in shell", async ({ page }) => {
  let signedIn = false;
  await page.route("**/auth/session", (r) =>
    signedIn
      ? r.fulfill({ status: 200, json: { user: { email: "ada@example.com" } } })
      : r.fulfill({ status: 401, json: { code: "session_expired" } }),
  );
  await page.route("**/auth/sign-in", (r) => {
    signedIn = true;
    return r.fulfill({ status: 200, json: {} });
  });
  await page.goto("/");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Password").fill("test-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
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
