summary: |
  The story asks for a UI page that shows a username input and a password input on load. The web app (comp_web_app, React + Vite + Tailwind, Vitest + Playwright) already has this page. SignInPage at apps/web/src/auth/SignInPage.tsx is rendered by App.tsx's Shell at "/" when nobody is signed in. It has an identifier input (type=email, label "Email", autoComplete="username") and a password input (type=password, label "Password"). So no new page is needed. The plan adds explicit tests that pin the two acceptance criteria (a Vitest component test and a Playwright load-time check) and makes no production change, unless the reviewer wants the visible label to read literally "Username" (see open questions).
scope:
  - description: |
      Add a Vitest spec block to the existing SignInPage tests that pins AC1 and AC2 as load-time behaviour.
      No production code change is planned; the tests are expected to pass against the current SignInPage.
    files:
      - apps/web/src/auth/SignInPage.test.tsx
    rationale: |
      The existing test "shows an email field and a password field on load" covers the "Email" label only. The new tests assert the username role of the identifier field (autocomplete="username", a text-entry textbox) and the password field, independent of the label wording.
  - description: |
      Add a Playwright test that opens "/" with no session and asserts both inputs are visible once loading finishes.
    files:
      - apps/web/e2e/auth.spec.ts
    rationale: |
      Matches the "WHEN the page finishes loading" wording against the real Vite-served page, using the same /auth/session 401 route stub as the existing tests.
tests:
  - |
    AC1 - username input shown on load (apps/web/src/auth/SignInPage.test.tsx):

    ```ts
    it("shows a username input on load (AC1)", () => {
      render(<SignInPage />);
      const field = screen.getByRole("textbox");
      expect(field).toBeVisible();
      expect(field).toHaveAttribute("autocomplete", "username");
    });
    ```
  - |
    AC2 - password input shown on load (apps/web/src/auth/SignInPage.test.tsx):

    ```ts
    it("shows a password input on load (AC2)", () => {
      render(<SignInPage />);
      const field = screen.getByLabelText(/password/i);
      expect(field).toBeVisible();
      expect(field).toHaveAttribute("type", "password");
    });
    ```
  - |
    AC1 + AC2 end to end (apps/web/e2e/auth.spec.ts):

    ```ts
    test("the sign-in page shows username and password inputs on load", async ({ page }) => {
      await page.route("**/auth/session", (r) =>
        r.fulfill({ status: 401, json: { code: "session_expired" } }),
      );
      await page.goto("/");
      await expect(page.locator('input[autocomplete="username"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
    });
    ```
    Run: `cd apps/web && pnpm test && pnpm e2e`
assumptions_or_open_questions:
  - |
    The existing SignInPage already satisfies both ACs, so the new tests are expected to pass immediately. They are regression pins rather than red-first tests. If a genuinely failing test is wanted first, see the next question.
  - |
    The identifier field is labelled "Email" and is type=email. The story says "username". I assumed the email address is the username (autoComplete="username" already says so). If the reviewer wants the visible label to read "Username", the change is a label edit in SignInPage.tsx plus updates to the getByLabelText(/email/i) calls in SignInPage.test.tsx and getByLabel("Email") in apps/web/e2e/auth.spec.ts. That would also be the red-first test.
  - |
    No new page or route is created, because the sign-in page at "/" is the only login surface and the story names no path.
estimated_points: 1
package_dependencies: []
notes: |
  ### Data & rollout

  None — UI tests only, no stored data, schema, settings or provisioning.

  Research findings: apps/web/src/auth/SignInPage.tsx (inputs at lines 29-50) is mounted by Shell in apps/web/src/App.tsx when `useAuth()` has no user. Tests use Vitest with jsdom and Testing Library (apps/web/vite.config.ts); e2e uses Playwright. Stack follows the confirmed comp_web_app decisions (react+vite, tailwindcss, pnpm, vitest, playwright). No new packages are needed.
review_focus: |
  IN scope: tests that pin the two load-time ACs on the existing sign-in page. OUT: any new page, auth logic, styling, or API change. The main thing to check is whether the reviewer accepts "Email" as the username field; the label question in the open questions is deliberate, not an oversight. Riskiest part: a label rename, if requested, would break the existing tests and e2e that look the field up by "Email".
