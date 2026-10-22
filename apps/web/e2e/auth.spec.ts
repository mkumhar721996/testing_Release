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

const SESSION_EXPIRED = { status: 401, json: { code: "session_expired" } } as const;

test("valid credentials lead into the app and sign out returns to sign-in (AC1, AC4)", async ({
  page,
}) => {
  let signedIn = false;
  await page.route("**/auth/session", (r) =>
    signedIn ? r.fulfill({ status: 200, json: { email: "ada@example.com" } }) : r.fulfill(SESSION_EXPIRED),
  );
  await page.route("**/auth/sign-in", (r) => {
    signedIn = true;
    return r.fulfill({ status: 200, json: {} });
  });
  await page.route("**/auth/sign-out", (r) => {
    signedIn = false;
    return r.fulfill({ status: 204 });
  });
  await page.goto("/");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Password").fill("test-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Web App" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("the sign-in screen is shown after the session expires from inactivity (AC3)", async ({
  page,
}) => {
  await page.route("**/auth/session", (r) =>
    r.fulfill({ status: 200, json: { email: "ada@example.com" } }),
  );
  await page.route("**/auth/sign-out", (r) => r.fulfill({ status: 204 }));
  await page.clock.install();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Web App" })).toBeVisible();
  await page.clock.fastForward("31:00");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("opening an app page address directly shows only sign-in (AC6, AC7)", async ({ page }) => {
  await page.route("**/auth/session", (r) => r.fulfill(SESSION_EXPIRED));
  await page.goto("/people");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Web App" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /sign up|register|create (an )?account/i })).toHaveCount(0);
});
