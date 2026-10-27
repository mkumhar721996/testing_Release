summary: |
  STORY-062 asks for username/password login with three outcomes: valid credentials sign the user in, a wrong password does not, and an unknown account does not. The repo already ships this from earlier stories (019 sign-in and activation, 046, 057). That covers `POST /auth/sign-in` in `services/api/src/auth`, the `SignInPage` and `AuthProvider` in `apps/web/src/auth`, and API, unit and Playwright tests. Here "username" is the account email, which is the identifier the existing flow uses. The plan is therefore verification-first. It runs the existing suites against the three ACs and adds only the test assertions the current suites lack for exact AC traceability. It makes no production-code change unless a new test fails.
scope:
  - description: |
      API e2e: add AC-named assertions for the three scenarios in the existing `Auth (e2e)` suite.
      The valid case also asserts the `sid` cookie and `GET /auth/session` returns 200 after submit.
      The wrong-password and unknown-username cases assert 401, no `set-cookie`, and `GET /auth/session` still returns 401 on the same agent (not signed in).
    files:
      - services/api/test/auth.e2e-spec.ts
    rationale: |
      The existing tests check the cookie and body but never probe the session after a refusal, which is what "not signed in" actually means.
  - description: |
      Web unit test: add a `SignInPage` test that a valid submit calls `signIn(email, password)` and shows no alert. The existing `App.test.tsx` already covers the signed-in shell.
    files:
      - apps/web/src/auth/SignInPage.test.tsx
    rationale: |
      The existing page tests only cover refusal paths. AC1 needs the success path covered at the page level.
  - description: |
      Playwright: extend the refused sign-in test to also assert the sign-in form is still shown and "Signed in as" is absent.
      Add a second refusal case for an unknown account (same mocked 401 generic body).
    files:
      - apps/web/e2e/auth.spec.ts
    rationale: |
      Covers AC2 and AC3 at the browser level. Both refusals look identical to the user by design (generic message).
  - description: |
      Production code stays untouched (`auth.service.ts`, `auth.controller.ts`, `SignInPage.tsx`, `AuthProvider.tsx`). Fix it only if one of the new tests exposes a real defect.
    files: []
    rationale: |
      The behaviour already exists. Stay within the ACs and avoid speculative changes.
tests:
  - |
    AC1, API e2e in services/api/test/auth.e2e-spec.ts. Register an active user, sign in, then probe the session.
    ```ts
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/sign-in').send({ email: user.email, password: PASSWORD }).expect(200);
    await agent.get('/auth/session').expect(200);
    ```
  - |
    AC1, web unit test in SignInPage.test.tsx. Mock `signIn` to resolve `{ ok: true }`. Then type email and password, click "Sign in", and assert:
    ```ts
    expect(signIn).toHaveBeenCalledWith("ada@example.com", "test-password");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    ```
  - |
    AC1, Playwright. The existing "a successful sign-in shows the user as signed in" test already asserts `Signed in as ada@example.com`. It is kept as is.
  - |
    AC2, API e2e. Register an active user, make Cognito reject with `InvalidCredentialsError`, and assert the user is not signed in.
    ```ts
    cognito.signIn.mockRejectedValue(new InvalidCredentialsError());
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post('/auth/sign-in').send({ email: user.email, password: 'wrong' }).expect(401);
    expect(res.headers['set-cookie']).toBeUndefined();
    await agent.get('/auth/session').expect(401);
    ```
  - |
    AC2, Playwright. Route `**/auth/sign-in` to a 401 and submit. Assert the user stays on the form.
    ```ts
    await expect(page.getByRole("alert")).toHaveText(GENERIC);
    await expect(page.getByText(/Signed in as/)).toHaveCount(0);
    ```
  - |
    AC3, API e2e. Use an unregistered email and assert Cognito is never called and no session exists.
    ```ts
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/sign-in').send({ email: 'nobody@example.com', password: 'anything' }).expect(401);
    expect(cognito.signIn).not.toHaveBeenCalled();
    await agent.get('/auth/session').expect(401);
    ```
  - |
    AC3, Playwright. Same shape as the AC2 test but with an unregistered email. Assert the generic alert and no "Signed in as" text.
  - |
    Run the unchanged suites to confirm nothing regressed. From services/api run `pnpm test` and `pnpm test:e2e`. From apps/web run `pnpm test` and `pnpm exec playwright test`. Confirm the actual script names in each package.json first.
assumptions_or_open_questions:
  - |
    "Username" means the account email, matching the existing Cognito-backed sign-in. The plan adds no separate username field. Please confirm.
  - |
    The feature appears already delivered by stories 019, 046 and 057. If the reviewer wants no new tests, the plan reduces to running the existing suites and closing the item.
  - |
    The e2e suite needs a PostgreSQL test database as it does today. No new infrastructure is assumed.
estimated_points: 2
package_dependencies: []
notes: |
  ### Data & rollout
  None — test-only additions, no schema, stored data, settings or provisioning changes.

  Research: `AuthService.signIn` (services/api/src/auth/auth.service.ts) lowercases and trims the email. It refuses unknown, non-active and locked accounts before calling Cognito, and treats `InvalidCredentialsError` as a refusal. All refusals return the same generic 401 body, "Incorrect email or password." The web `SignInPage` shows that message in an alert and keeps the form on screen. ADR-0007 (Identity Provider, Cognito) governs credential checking.
review_focus: |
  IN scope: test-only additions that trace the three ACs (API e2e with supertest, vitest for the web page, Playwright). OUT of scope: any change to the sign-in, lockout, activation or reset logic, or a separate username field. The risk is duplicating existing coverage, so reviewers should check that each new assertion adds a session-state or success-path check not already present. Unknown and wrong-password refusals are deliberately indistinguishable to the user.
