summary: |
  Username/password sign-in already exists from earlier stories: the API has POST /auth/sign-in and GET /auth/session in services/api/src/auth/auth.controller.ts, with an API e2e test, and the web app has SignInPage, AuthProvider and authClient wired into App.tsx Shell. The one acceptance criterion (valid credentials sign the user in and the login form is no longer shown) is only partly covered by web tests. No unit test drives the real AuthProvider through a successful sign-in and asserts the form is gone. The existing Playwright success test mocks GET /auth/session as 401 for the whole test, so after sign-in AuthProvider re-reads the session, gets null, and the form stays up. This plan adds the missing tests first, then makes the minimum fix if they expose a real defect, and keeps everything else untouched.
scope:
  - description: |
      Add a failing-first web integration test in App.test.tsx covering the AC. It uses the real AuthProvider, SignInPage and Shell with authClient mocked. getSession resolves null first and then the user after signIn resolves. Submitting valid credentials must remove the "Sign in" heading and show "Signed in as ada@example.com".
      This test is expected to pass against the current code, which would show the behaviour is already implemented. Its purpose is to pin the behaviour. If it fails, fix AuthProvider.signIn or Shell with the smallest change.
    files:
      - apps/web/src/App.test.tsx
    rationale: |
      The AC spans SignInPage, AuthProvider and Shell, and no existing test crosses all three on the success path.
  - description: |
      Make the Playwright success test stateful so it models a real session. GET /auth/session returns 401 until POST /auth/sign-in has been fulfilled, then returns 200 with the user. Add assertions that the form is gone.
    files:
      - apps/web/e2e/auth.spec.ts
    rationale: |
      The current mock keeps /auth/session at 401 after sign-in, so AuthProvider's follow-up getSession returns null. The test cannot pass for the right reason and does not assert the form disappears.
  - description: |
      Add an AuthProvider unit test that signIn with ok true updates user from getSession, and that a refused signIn leaves user null.
    files:
      - apps/web/src/auth/AuthProvider.test.tsx
    rationale: |
      The existing AuthProvider tests cover only the session probe and sign-out, not the sign-in transition.
  - description: |
      Conditional production change, made only if the new tests fail. Keep it minimal and inside AuthProvider.signIn or Shell. Do not touch the API, which already has e2e coverage of sign-in, session and sign-out.
    files:
      - apps/web/src/auth/AuthProvider.tsx
      - apps/web/src/App.tsx
    rationale: |
      Keeps the plan strictly inside the AC and avoids speculative work.
tests:
  - |
    App.test.tsx, "hides the sign-in form after a valid sign-in (AC1)". getSession is mocked null then the user, and signIn is mocked to resolve ok true.
    ```ts
    vi.mocked(client.getSession)
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ email: "ada@example.com" });
    vi.mocked(client.signIn).mockResolvedValue({ ok: true });
    render(<App />);
    await user.type(await screen.findByLabelText(/email/i), "ada@example.com");
    await user.type(screen.getByLabelText(/password/i), "test-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Signed in as ada@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sign in" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    ```
  - |
    AuthProvider.test.tsx, "sets the user after a successful sign-in (AC1)". A Probe calls signIn and the test expects "in:ada@example.com".
    ```ts
    vi.mocked(client.getSession).mockResolvedValueOnce(null).mockResolvedValue({ email: "ada@example.com" });
    vi.mocked(client.signIn).mockResolvedValue({ ok: true });
    // after clicking the probe's sign-in button
    expect(await screen.findByText("in:ada@example.com")).toBeInTheDocument();
    ```
  - |
    e2e/auth.spec.ts, "a successful sign-in shows the user as signed in and removes the form (AC1)". A stateful route mock is used.
    ```ts
    let signedIn = false;
    await page.route("**/auth/session", (r) =>
      signedIn
        ? r.fulfill({ status: 200, json: { user: { id: "u1", email: "ada@example.com" } } })
        : r.fulfill({ status: 401, json: { code: "session_expired" } }),
    );
    await page.route("**/auth/sign-in", (r) => {
      signedIn = true;
      return r.fulfill({ status: 200, json: { status: "signed_in", user: { id: "u1", email: "ada@example.com" } } });
    });
    // fill and submit, then
    await expect(page.getByText("Signed in as ada@example.com")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sign in" })).toHaveCount(0);
    ```
  - |
    Run `cd apps/web && pnpm vitest run` (vitest) and `cd apps/web && pnpm playwright test` (playwright). Regression check: `cd services/api && pnpm test:e2e`. The API test is existing and should be unchanged.
assumptions_or_open_questions:
  - |
    Assumed the story's "username" means the email address. SignInPage and the API already use email as the login identifier through Cognito, and the stack docs name AWS Cognito as the identity provider. No separate username field is planned.
  - |
    The feature appears to already be implemented (stories 019, 046 and 057 are in git history). If the reviewer expects new behaviour beyond the tests, such as a different post-login landing page, please say so, because none is in this AC.
  - |
    Assumed the playwright e2e command works in this environment with the existing playwright.config.ts. Not verified.
estimated_points: 2
package_dependencies: []
notes: |
  ### Data & rollout

  None — test-only change with at most a minimal conditional UI fix. There is no schema, stored data, seed or setting change.

  Existing behaviour was read in apps/web/src/auth/SignInPage.tsx, AuthProvider.tsx, authClient.ts, apps/web/src/App.tsx, and services/api/src/auth/auth.controller.ts. The API already refuses wrong credentials with a generic message and sets an httpOnly session cookie on success.

  The flowchart marks the files the plan touches.

  ```mermaid
  flowchart TD
    App[App.tsx Shell] --> AP[AuthProvider.tsx]
    App --> SP[SignInPage.tsx]
    SP --> AP
    AP --> AC[authClient.ts]
    AC --> API[auth.controller.ts POST sign-in, GET session]
    AT[App.test.tsx]:::touched -->|new success-path test| App
    APT[AuthProvider.test.tsx]:::touched -->|new sign-in test| AP
    E2E[e2e/auth.spec.ts]:::touched -->|stateful session mock| App
    classDef touched fill:#f96,color:#000
  ```
review_focus: |
  IN scope are web-side tests for the AC (form is gone and the user is shown as signed in after valid credentials) and a fix to the stateful Playwright mock. OUT of scope are API changes, new UI, and username-versus-email changes. The riskiest part is the e2e mock, which must be stateful so the post-sign-in session read succeeds. It is deliberate that the plan may produce no production change, because the behaviour already exists and the work is to pin it with tests.
