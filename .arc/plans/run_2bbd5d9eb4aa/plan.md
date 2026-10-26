summary: |
  Sign-in with email and password already exists from STORY-019 (SignInPage in comp_web_app, POST /auth/sign-in in comp_api_service backed by Cognito, and a signed-in shell in App.tsx). This item therefore adds missing test coverage for the five acceptance criteria and closes the one real behavioural gap, which is that the API controller accepts an empty-string password and passes it on to Cognito. The Web App is the "shopping page" in the item text, and the existing Email field is the "username" because the project's sign-in identifier is the email. No new screens, fields or dependencies are added.
scope:
  - description: |
      Reject an empty password in the sign-in controller before any lookup or Cognito call, using the same generic refusal as every other failure (AC4). Before: only `typeof body.password !== 'string'` is refused. After:

      ```ts
      if (
        typeof body?.email !== 'string' ||
        typeof body?.password !== 'string' ||
        body.password === ''
      ) {
        throw new SignInRefusedError();
      }
      ```
    files:
      - services/api/src/auth/auth.controller.ts
    rationale: |
      The form's `required` attribute only stops the browser; a direct API call with an empty password currently reaches Cognito, and a permissive IdP or the fake would log the user in. Throwing SignInRefusedError keeps the response identical to other refusals (no account enumeration) and does not touch the failed-attempt counter.
  - description: |
      API tests for AC1 to AC4 added to the existing e2e suite: correct credentials return 200 with a cookie, wrong password returns 401 with no cookie (already covered, keep), unknown user returns 401 with no cookie, empty password returns 401 with no cookie and no Cognito call.
    files:
      - services/api/test/auth.e2e-spec.ts
    rationale: Extends the supertest suite that already boots AppModule with the fake Cognito and clock.
  - description: |
      Web unit tests for the SignInPage: AC5 fields shown on load, AC4 empty password does not call signIn, AC2/AC3 a refused sign-in keeps the form on screen with the generic alert. A sign-in success test in App.test.tsx covers AC1 (the shell shows "Signed in as ...").
    files:
      - apps/web/src/auth/SignInPage.test.tsx
      - apps/web/src/App.test.tsx
    rationale: Component-level proof of each UI criterion using the existing mocking style (mocked useAuth, mocked authClient).
  - description: |
      Playwright e2e for the happy path: with /auth/session first returning 401 and /auth/sign-in returning 200, submitting the form shows "Signed in as ada@example.com". Existing refused-sign-in e2e already covers AC2/AC3 in the browser.
    files:
      - apps/web/e2e/auth.spec.ts
    rationale: AC1 end to end in the browser, using the route-mocking pattern of the existing specs.
tests:
  - |
    AC5, apps/web/src/auth/SignInPage.test.tsx (passes against current code, characterisation):
    ```ts
    render(<SignInPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toHaveAttribute("type", "password");
    ```
  - |
    AC1, apps/web/src/App.test.tsx plus Playwright. Unit version:
    ```ts
    vi.mocked(client.getSession).mockResolvedValue({ email: "ada@example.com" });
    render(<App />);
    expect(await screen.findByText("Signed in as ada@example.com")).toBeInTheDocument();
    ```
    Playwright version in apps/web/e2e/auth.spec.ts, after filling the form and clicking Sign in:
    ```ts
    await expect(page.getByText("Signed in as ada@example.com")).toBeVisible();
    ```
  - |
    AC1 API, services/api/test/auth.e2e-spec.ts (already covered by "signs in, probes the session and signs out"; keep it unchanged and assert the 200 and sid cookie there).
  - |
    AC2, SignInPage.test.tsx and the existing e2e "a refused sign-in shows only the generic message". Unit version:
    ```ts
    signIn.mockResolvedValue({ ok: false, message: GENERIC });
    // fill in and submit
    expect(await screen.findByRole("alert")).toHaveTextContent(GENERIC);
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    ```
    API side is already covered by "refuses a wrong password without a cookie (AC6)".
  - |
    AC3, services/api/test/auth.e2e-spec.ts, new test, passes today:
    ```ts
    const res = await signIn('nobody@example.com', 'anything').expect(401);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.body).toEqual(GENERIC);
    ```
  - |
    AC4, services/api/test/auth.e2e-spec.ts, new test. FAILS first because the controller forwards '' to Cognito and the mocked Cognito resolves:
    ```ts
    const user = await makeUser();
    const res = await signIn(user.email, '').expect(401);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(cognito.signIn).not.toHaveBeenCalled();
    ```
    Also in SignInPage.test.tsx, submitting with the password empty must not call signIn:
    ```ts
    await user.type(screen.getByLabelText(/email/i), "ada@example.com");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(signIn).not.toHaveBeenCalled();
    ```
assumptions_or_open_questions:
  - |
    "Amazon shopping page" is read as this project's Web App, since no Amazon or shopping code exists in the repository and the architecture docs describe a business-dashboard SPA. Please confirm no separate page is intended.
  - |
    "Username" is taken to mean the Email field, which is the existing sign-in identifier (the API looks users up by email and Cognito signs in with the email). Adding a separate username field would be a new feature and is out of scope.
  - |
    The signed-in indicator for AC1 is the existing "Signed in as {email}" text in App.tsx; no change to it is planned.
  - |
    Most criteria are already satisfied by STORY-019, so only AC4 (server-side empty password) needs production code. The reviewer may prefer to keep only the new tests and drop the controller change if they judge the empty-password case unreachable.
estimated_points: 2
package_dependencies: []
notes: |
  ### Data & rollout

  None — a request-validation check and tests only; no schema, stored data, seed or setting changes, and it can be rolled back by reverting the commit.

  The identity provider is AWS Cognito (comp_identity_provider) behind the CognitoAuthPort, which tests replace with fakeCognito, so no real IdP is needed for these tests.

  ```mermaid
  flowchart TD
    SP[SignInPage.tsx] --> AP[AuthProvider.tsx]
    AP --> AC[authClient.ts]
    AC -->|POST /auth/sign-in| CT[auth.controller.ts]
    CT --> SV[auth.service.ts]
    SV --> CG[cognito-auth.port.ts]
    CT -. empty password refused here .-> CT
    classDef touched fill:#f96,color:#000
    class CT touched
  ```

  Only auth.controller.ts changes in production code (the orange node). The test files touched are SignInPage.test.tsx, App.test.tsx, auth.spec.ts and auth.e2e-spec.ts.
review_focus: |
  IN scope: tests for AC1 to AC5 plus a one-condition controller change refusing an empty password (AC4). OUT of scope: new fields, a separate username concept, UI changes, lockout or session changes. Riskiest part is making sure the empty-password refusal returns the same generic 401 body and does not count as a failed attempt; most of the diff being tests over already-working behaviour is deliberate.
