summary: |
  Username-and-password login already exists from earlier stories (STORY-019 sign-in and account activation, plus later login stories). The username is the account email. The API exposes POST /auth/sign-in (AuthController, AuthService, Cognito port, session cookie), and the web app has SignInPage and AuthProvider. This plan adds no new feature. It maps AC1 and AC2 to the tests that already cover them, adds the few missing thin tests that pin the two ACs at the unit boundaries (the web form's submit and the AuthProvider's signed-in state), and runs the full suites to confirm.
scope:
  - description: |
      Add two web unit tests. SignInPage submits the typed email and password to useAuth().signIn exactly once (AC1). AuthProvider.signIn on a 200 response exposes the user, and on a 401 leaves the user null (AC1 and AC2). Production code changes only if a test exposes a real defect.
    files:
      - apps/web/src/auth/SignInPage.test.tsx
      - apps/web/src/auth/AuthProvider.test.tsx
    rationale: |
      The API side is already covered (auth.service.spec.ts, auth.e2e-spec.ts). The web side has no test for the successful submit path or for the provider state after sign-in.
  - description: |
      Verify only, with no edits. The existing API tests that cover the ACs are listed under tests, and the whole API suite is run to confirm they pass.
    files:
      - services/api/src/auth/auth.service.spec.ts
      - services/api/test/auth.e2e-spec.ts
    rationale: |
      Confirms AC1 and AC2 hold on the real HTTP path (cookie set on success, none on refusal).
tests:
  - |
    AC1, web form (new). In apps/web/src/auth/SignInPage.test.tsx, render the page with a mocked useAuth().signIn that resolves to { ok: true }. Fill Email with ada@example.com and Password with test-password, click "Sign in", then assert:
    expect(signIn).toHaveBeenCalledWith("ada@example.com", "test-password"); expect(signIn).toHaveBeenCalledTimes(1);
  - |
    AC1 and AC2, provider (new). In apps/web/src/auth/AuthProvider.test.tsx, mock fetch to return 200 with { status: "signed_in", user: { id: "u1", email: "ada@example.com" } } and assert the user is exposed as ada@example.com. Then mock fetch to return 401 with { message: "Incorrect email or password." } and assert:
    expect(result).toEqual({ ok: false, message: "Incorrect email or password." }); and that user stays null.
  - |
    AC1, API (existing, must pass). auth.service.spec.ts "signs in with valid credentials" and auth.e2e-spec.ts "signs in, probes the session and signs out" assert a 200, an HttpOnly sid cookie, and the signed_in body.
  - |
    AC2, API (existing, must pass). auth.service.spec.ts "refuses a wrong password and counts it" and "refuses unknown and pending accounts without calling Cognito". auth.e2e-spec.ts "refuses a wrong password without a cookie" and "refuses an unregistered username without a cookie" assert a 401, no set-cookie header, and the generic body.
  - |
    AC1 and AC2, browser (existing, must pass). apps/web/e2e/auth.spec.ts "a refused sign-in shows only the generic message" and "a successful sign-in shows the user as signed in".
  - |
    Run commands: cd services/api && pnpm test && pnpm test:e2e; cd apps/web && pnpm test && pnpm test:e2e (check the script names in each package.json).
assumptions_or_open_questions:
  - |
    "Username" is treated as the account email, which is the existing identifier on the sign-in form and API. Adding a separate username field would be a large change to the schema and Cognito, so it is out of scope unless the reviewer says otherwise.
  - |
    This story is treated as already satisfied by existing code. If the reviewer expected new behaviour, please say what is missing. For example, a separate username, or a redirect after login.
  - |
    The test files may use different mocking styles (vi.mock of AuthProvider, or mocked fetch). The implementer should follow what the neighbouring tests in the same file already do.
estimated_points: 1
package_dependencies: []
notes: |
  ### Data & rollout

  None — tests only, with no schema, stored data, seed or setting changes.

  Existing implementation that was read: services/api/src/auth/auth.controller.ts (POST /auth/sign-in returns 200 plus cookie, or a generic 401), services/api/src/auth/auth.service.ts (a row-locked transaction around the Cognito call, with lockout), apps/web/src/auth/SignInPage.tsx. Auth is delegated to AWS Cognito (comp_identity_provider) behind the COGNITO_AUTH port, as the architecture docs state. The stack is NestJS with jest and supertest for the API, and React with vitest and playwright for the web app.
review_focus: |
  IN scope: two small web unit tests and a verification run of the existing suites. OUT of scope: any new login feature, a separate username field, and changes to lockout or session behaviour. The riskiest point is the assumption that this story is already implemented, so the reviewer should confirm that reading. Username equals email is deliberate.
