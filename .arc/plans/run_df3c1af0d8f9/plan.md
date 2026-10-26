summary: |
  Username/password sign-in already exists from STORY-019 (sign-in and account activation): `POST /auth/sign-in` in comp_api_service (AuthService.signIn over the Cognito port, with lockout and sessions) and the SignInPage / AuthProvider in comp_web_app. Both acceptance criteria are therefore mostly implemented and covered at the API level and in Playwright. This plan does not rebuild login. It closes the one gap I found, which is that AuthProvider has no unit test that a successful sign-in sets the user and a refused one leaves the user signed out. It adds those tests first, and makes a code change only if one fails.
scope:
  - description: |
      Add AuthProvider unit tests for the sign-in outcome. Success must set `user`. A refusal must return `{ ok: false, message }` and leave `user` null. Change AuthProvider.tsx only if a test exposes a real defect.
    files:
      - apps/web/src/auth/AuthProvider.test.tsx
      - apps/web/src/auth/AuthProvider.tsx
    rationale: |
      AC1 and AC2 at the web-state level. The existing tests cover only the session probe and sign-out. The SignInPage tests mock `useAuth` entirely, so nothing asserts the "logged in" state transition.
  - description: |
      Verify and, if missing, add API tests that map one-to-one to the ACs. AC1 is a valid password that returns 200 and a `sid` cookie. AC2 is a wrong password for a registered, active user that returns 401 and no cookie. The wrong-password e2e test and the AuthService unit tests appear to cover this already. Read services/api/src/auth/auth.service.spec.ts and add a case only if one is absent.
    files:
      - services/api/src/auth/auth.service.spec.ts
    rationale: |
      Guards against drift without duplicating existing coverage. This is likely a no-op.
tests:
  - |
    AC1, apps/web/src/auth/AuthProvider.test.tsx. A valid sign-in puts the user in a logged-in state.
    ```tsx
    vi.mocked(client.getSession).mockResolvedValue(null);
    vi.mocked(client.signIn).mockResolvedValue({ ok: true, user: { email: "ada@example.com" } });
    // render <AuthProvider><SignInProbe/></AuthProvider>, click "go"
    expect(await screen.findByText("in:ada@example.com")).toBeInTheDocument();
    ```
  - |
    AC2, apps/web/src/auth/AuthProvider.test.tsx. A wrong password does not log the user in.
    ```tsx
    vi.mocked(client.signIn).mockResolvedValue({ ok: false, message: "Incorrect email or password." });
    // click "go"
    expect(await screen.findByText("out")).toBeInTheDocument();
    expect(screen.queryByText(/^in:/)).toBeNull();
    ```
  - |
    Regression guard, run unchanged. The existing e2e specs `signs in, probes the session and signs out` (AC1) and `refuses a wrong password without a cookie` (AC2) in services/api/test/auth.e2e-spec.ts, and the Playwright specs in apps/web/e2e/auth.spec.ts. Commands: `cd services/api && pnpm test && pnpm test:e2e`, then `cd apps/web && pnpm test`.
assumptions_or_open_questions:
  - |
    The "Amazon shopping page" in the story is read as this project's own web app. The architecture docs describe a role-based business dashboard SPA authenticating via Cognito, not an Amazon storefront, and there is no integration with amazon.com. Please confirm that no separate shopping page or amazon.com login is intended.
  - |
    "Username" is read as the account email, because the existing sign-in form and API use email as the username. No new username field is added.
  - |
    The authClient.signIn return shape (`{ ok, user }` or `{ ok, message }`) is inferred from SignInPage.test.tsx. Confirm it in authClient.ts before writing the tests.
  - |
    This work item may be largely redundant with STORY-019 and STORY-046. If the reviewer wants no change, the plan reduces to the two small test additions.
estimated_points: 2
package_dependencies: []
notes: |
  ### Data & rollout

  None — tests only, with no schema, stored data, settings or provisioning changes.

  Existing sign-in code reviewed: services/api/src/auth/auth.service.ts, services/api/test/auth.e2e-spec.ts, apps/web/src/auth/SignInPage.tsx and SignInPage.test.tsx, AuthProvider.test.tsx, and apps/web/e2e/auth.spec.ts. Stack is unchanged (NestJS with jest and supertest, React with vitest and playwright, pnpm).
review_focus: |
  IN scope: tests for the sign-in success and refusal states in AuthProvider, and a check that the API tests already map to AC1 and AC2. OUT of scope: rebuilding login, the lockout and session behaviour, and any amazon.com integration. The main risk is duplicating STORY-019 work, so a reviewer should confirm that the new tests add coverage and do not repeat existing cases. The generic refusal message is deliberate, because it prevents account enumeration.
