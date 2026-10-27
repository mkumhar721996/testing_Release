import { test, expect, type Page } from "@playwright/test";

const USERNAME = /user ?name|email/i;
const PASSWORD = /password/i;
const SIGN_IN = /sign in/i;
const PROJECT = /project/i;

const hasCredentials = !!process.env.QA_USERNAME && !!process.env.QA_PASSWORD;

async function signIn(page: Page, username: string, password: string) {
  await page.goto("/");
  await page.getByLabel(USERNAME).fill(username);
  await page.getByLabel(PASSWORD).fill(password);
  await page.getByRole("button", { name: SIGN_IN }).click();
}

test("the login page shows username and password fields", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel(USERNAME)).toBeVisible();
  await expect(page.getByLabel(PASSWORD)).toBeVisible();
});

test.describe("with valid credentials", () => {
  test.skip(!hasCredentials, "QA credentials not set");

  test("sign-in shows a project dropdown", async ({ page }) => {
    await signIn(page, process.env.QA_USERNAME!, process.env.QA_PASSWORD!);
    await expect(page.getByRole("combobox", { name: PROJECT })).toBeVisible();
  });

  test("selecting a project shows the arc page for it", async ({ page }) => {
    await signIn(page, process.env.QA_USERNAME!, process.env.QA_PASSWORD!);
    const dropdown = page.getByRole("combobox", { name: PROJECT });
    await expect(dropdown).toBeVisible();
    const label = await dropdown.locator("option").nth(1).innerText();
    await dropdown.selectOption({ label });
    await expect(page.getByText(label).first()).toBeVisible();
    await expect(dropdown).toHaveValue(/.+/);
  });
});

test.describe("with invalid credentials", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "not-a-user", "wrong-password");
  });

  test("sign-in shows an error message", async ({ page }) => {
    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("the login page remains shown", async ({ page }) => {
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByLabel(PASSWORD)).toBeVisible();
    await expect(page.getByRole("button", { name: SIGN_IN })).toBeVisible();
    await expect(page.getByRole("combobox", { name: PROJECT })).toHaveCount(0);
  });
});
