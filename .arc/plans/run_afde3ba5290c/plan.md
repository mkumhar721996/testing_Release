summary: |
  Add a Playwright end-to-end suite for comp_web_app that exercises the deployed QA site (https://qa.bnts-arc.ai/) login journey: the login page shows username and password fields, a valid sign-in shows a project dropdown, selecting a project shows the arc page, and an invalid sign-in shows an error while the login page stays. This is test automation (parent epic Test_Automation); no production code changes. The suite runs through its own Playwright config so the existing localhost-based, mocked e2e suite is untouched.
scope:
  - description: |
      New Playwright config for the QA environment. baseURL comes from `QA_BASE_URL` (default `https://qa.bnts-arc.ai`), `testDir` is `./e2e-qa`, and there is no `webServer` block, because the target is already deployed. Chromium project only, same as the existing config.
      ```ts
      export default defineConfig({
        testDir: "./e2e-qa",
        use: { baseURL: process.env.QA_BASE_URL ?? "https://qa.bnts-arc.ai", trace: "on-first-retry" },
        projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
      });
      ```
    files:
      - apps/web/playwright.qa.config.ts
    rationale: |
      The existing playwright.config.ts pins baseURL to localhost:4173 and builds the app in webServer. A separate config avoids changing how the current mocked specs run.
  - description: |
      New spec `login.spec.ts` with one test per acceptance criterion (see `tests`). Credentials are read from `QA_USERNAME` / `QA_PASSWORD`. The valid-login tests call `test.skip(!process.env.QA_USERNAME || !process.env.QA_PASSWORD, "QA credentials not set")`. Nothing is hardcoded or committed. Locators use role and label (`getByLabel`, `getByRole`) in the style of apps/web/e2e/auth.spec.ts.
    files:
      - apps/web/e2e-qa/login.spec.ts
    rationale: Covers AC1 to AC5 directly against the QA site.
  - description: |
      Add the script `"e2e:qa": "playwright test -c playwright.qa.config.ts"` to apps/web/package.json. Document the three env vars and the command in a short section of README.md.
    files:
      - apps/web/package.json
      - README.md
    rationale: Gives a one-line way to run the suite locally or in CI, and documents the required secrets.
tests:
  - |
    AC1 — login page shows username and password fields (write first; it fails until the selectors match the QA page):
    ```ts
    await page.goto("/");
    await expect(page.getByLabel(/user ?name|email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    ```
  - |
    AC2 — valid credentials, then Sign in, shows a project dropdown:
    ```ts
    await page.getByLabel(/user ?name|email/i).fill(process.env.QA_USERNAME!);
    await page.getByLabel(/password/i).fill(process.env.QA_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByRole("combobox", { name: /project/i })).toBeVisible();
    ```
  - |
    AC3 — selecting a project shows the arc page for that project:
    ```ts
    const dropdown = page.getByRole("combobox", { name: /project/i });
    const label = await dropdown.locator("option").nth(1).innerText();
    await dropdown.selectOption({ label });
    await expect(page.getByText(label).first()).toBeVisible();
    await expect(page.getByRole("combobox", { name: /project/i })).toHaveValue(/.+/);
    ```
    The assertion that identifies the arc page must be tightened to a stable heading or URL once the real QA DOM is inspected.
  - |
    AC4 — invalid credentials, then Sign in, shows an error:
    ```ts
    await page.getByLabel(/user ?name|email/i).fill("not-a-user");
    await page.getByLabel(/password/i).fill("wrong-password");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    ```
  - |
    AC5 — after the failed sign-in, the login page remains:
    ```ts
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole("combobox", { name: /project/i })).toHaveCount(0);
    ```
assumptions_or_open_questions:
  - |
    The repo's own SignInPage (apps/web/src/auth/SignInPage.tsx) uses an "Email" field, has no project dropdown, and has no arc page (grep for "project" in apps/web/src finds nothing). The plan therefore assumes the QA site at qa.bnts-arc.ai is a different, deployed UI. The selectors (username label, "project" combobox, role=alert error) are guesses. They must be confirmed against the live DOM, or a test-id convention agreed.
  - |
    Open question for the reviewer: should these tests live in this repo (apps/web/e2e-qa) or in a separate test-automation repo for the Test_Automation epic?
  - |
    A valid QA username and password must be supplied as the secrets QA_USERNAME and QA_PASSWORD. Without them AC2 and AC3 are skipped, not failed. Which test account to use is an open question for the reviewer.
  - |
    "Arc page shown" has no precise definition in the item. The plan assumes a stable heading or URL change that identifies it, to be pinned during implementation.
  - |
    The item text mentions "next arc page should be visible, or there is project dropdown". The ACs are taken as authoritative: the dropdown appears first, then the arc page appears after a project is selected.
estimated_points: 3
package_dependencies: []
notes: |
  ### Data & rollout

  None — test-only change; no schema, stored data, seeds, or runtime settings. The only new inputs are the test-time env vars QA_BASE_URL, QA_USERNAME and QA_PASSWORD, documented in README.md.

  The suite is aimed at a shared QA environment, so it never creates data. The invalid-login test uses a clearly fake user, which could count toward any lockout policy on the QA identity provider (Cognito, ADR-0007), so it must not use a real account's username.

  Stack: comp_web_app uses Playwright for E2E (confirmed stack), so no new dependency is needed. `@playwright/test` is already in apps/web/package.json.

  The existing apps/web/e2e specs mock `**/auth/*` routes against a local build. This suite deliberately does not mock; it tests the real deployment.
review_focus: |
  IN scope: a Playwright QA config, one spec with five tests (one per AC), an `e2e:qa` script, and README docs. OUT of scope: any change to the app source, the existing e2e suite, or CI wiring. Riskiest part: the selectors are unverified guesses, because the repo contains no project dropdown or arc page, so a reviewer should check they are confirmed against the live QA DOM. Credentials come only from env vars; the skipped-without-credentials behaviour is deliberate.
