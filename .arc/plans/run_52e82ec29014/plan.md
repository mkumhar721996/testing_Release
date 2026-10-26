summary: |
  Username/password sign-in already exists from STORY-019 (SignInPage, AuthProvider, authClient on the web app; POST /auth/sign-in on the API service backed by Cognito). This item's three ACs (successful login, wrong-password refusal, form shows username and password fields) are therefore mostly a coverage gap, not a feature gap. The plan adds failing-first web tests that pin each AC to the existing form and the App-level flow, and only touches production code if one of those tests exposes a real defect. The "username" is the user's email, which is the identifier the existing form and API use.
scope:
  - description: |
      AC3 and AC2 at component level. Add tests to the existing SignInPage test file. One asserts the form renders an Email (username) field and a Password field with type password and a submit button. One asserts that after a refused sign-in the password field is cleared and no signed-in state is entered.
    files:
      - apps/web/src/auth/SignInPage.test.tsx
    rationale: |
      The current file only covers the generic error message (STORY-019 AC7). It has no assertion on which fields are displayed.
  - description: |
      AC1 and AC2 at App level. Add tests to App.test.tsx that render App with the auth client mocked, submit the form, and assert the outcome. A successful sign-in (signIn returns ok, getSession then returns the user) replaces the form with the signed-in shell. A refused sign-in (signIn returns ok false) leaves the sign-in heading visible and the shell absent.
    files:
      - apps/web/src/App.test.tsx
    rationale: |
      This is the only layer where "logged in" and "not logged in" are observable as UI state through AuthProvider.
  - description: |
      Browser-level coverage with Playwright using route mocks, as the existing auth.spec.ts does. Add a success case, where POST /auth/sign-in returns 200 and GET /auth/session then returns 200 with the user, so the signed-in shell shows. The wrong-password refusal case already exists, so extend it to assert the sign-in form is still shown.
    files:
      - apps/web/e2e/auth.spec.ts
    rationale: |
      Confirms AC1 through AC3 end to end against the real built SPA without needing Cognito.
  - description: |
      Production code change only if a new test fails for a real reason. Expected change is none. The API side already has e2e coverage in services/api/test/auth.e2e-spec.ts for sign-in success and wrong-password refusal, so no API change is planned.
    files:
      - apps/web/src/auth/SignInPage.tsx
    rationale: |
      Contingency only. Keeps the plan within the ACs and avoids speculative rework of working code.
tests:
  - |
    AC3 in SignInPage.test.tsx. Write first, expected to pass against the existing form, so confirm it fails if a field is removed.
    ```tsx
    it("shows a username field and a password field (AC3)", () => {
      render(<SignInPage />);
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toHaveAttribute("type", "password");
      expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    });
    ```
  - |
    AC1 in App.test.tsx.
    ```tsx
    it("logs the user in after valid credentials (AC1)", async () => {
      vi.mocked(client.getSession).mockResolvedValueOnce(null).mockResolvedValue({ email: "ada@example.com" });
      vi.mocked(client.signIn).mockResolvedValue({ ok: true });
      const user = userEvent.setup();
      render(<App />);
      await user.type(await screen.findByLabelText(/email/i), "ada@example.com");
      await user.type(screen.getByLabelText(/password/i), "test-password");
      await user.click(screen.getByRole("button", { name: /sign in/i }));
      expect(await screen.findByRole("button", { name: "Sign out" })).toBeInTheDocument();
    });
    ```
  - |
    AC2 in App.test.tsx and SignInPage.test.tsx.
    ```tsx
    it("does not log the user in on a wrong password (AC2)", async () => {
      vi.mocked(client.getSession).mockResolvedValue(null);
      vi.mocked(client.signIn).mockResolvedValue({ ok: false, message: "Incorrect email or password." });
      const user = userEvent.setup();
      render(<App />);
      await user.type(await screen.findByLabelText(/email/i), "ada@example.com");
      await user.type(screen.getByLabelText(/password/i), "wrong");
      await user.click(screen.getByRole("button", { name: /sign in/i }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
      expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toHaveValue("");
    });
    ```
  - |
    Playwright in apps/web/e2e/auth.spec.ts. Success case, plus an extra assertion on the existing refusal case.
    ```ts
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible(); // success
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible(); // after refusal
    ```
  - |
    Run `cd apps/web && pnpm vitest run` and `cd apps/web && pnpm playwright test`. The existing API e2e suite, run with `cd services/api && pnpm test:e2e`, must stay green with no edits.
assumptions_or_open_questions:
  - |
    The item says "Amazon shopping page". The repository has no Amazon or shopping page. I treated this as the project's existing web app sign-in page. Please confirm that reading, because if a separate page is intended the scope changes substantially.
  - |
    "Username" is taken to mean the account email, as in the existing form and POST /auth/sign-in. No separate username field or API change is planned.
  - |
    The signIn mock in App.test.tsx assumes the SignInResult type accepts an object with only ok set to true. Verify it against apps/web/src/auth/authClient.ts when writing the test.
  - |
    If the reviewer wants new production behaviour, for example a distinct username identifier, say so and I will revise the plan.
estimated_points: 2
package_dependencies: []
notes: |
  ### Data & rollout

  None — tests only against existing sign-in code, with no schema, stored data, settings or provisioning changes.

  Research findings: STORY-019 (commit a2b70ac) already delivered SignInPage.tsx, AuthProvider.tsx, authClient.ts, the API auth module (auth.controller.ts, auth.service.ts, Cognito port) and services/api/test/auth.e2e-spec.ts. The stack is per the architecture docs: React with Vite, Vitest and Playwright on comp_web_app, and NestJS with Jest and supertest on comp_api_service. Authentication goes through Cognito (ADR-0007). No new libraries are needed, since @testing-library/user-event is already used in the existing tests.
review_focus: |
  IN scope are new web tests for the three ACs (SignInPage.test.tsx, App.test.tsx, apps/web/e2e/auth.spec.ts). OUT of scope is any API or sign-in UI change, because that behaviour already shipped in STORY-019. The main thing to check is the item's "Amazon shopping page" wording, which has no counterpart in the repo, so the plan targets the existing sign-in page. Because the new tests are expected to pass on first run against existing code, the reviewer should check they would fail if the behaviour regressed.
