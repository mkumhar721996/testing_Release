summary: |
  Username-and-password login already exists in this repo, delivered by earlier stories (STORY-019 sign-in and activation, plus STORY-046 and STORY-057). The API has POST /auth/sign-in backed by Cognito, and the web app has SignInPage, AuthProvider and authClient. The system identifies a user by email, so the "username" in this story is the email address. This plan does not rebuild any of that. It closes the remaining test gaps so each of the story's three acceptance criteria is pinned by an explicit test that names it. The one real gap is that the web unit suite has no test for the successful submit on SignInPage. Everything else is already covered by existing tests, which the plan maps to the criteria.
scope:
  - description: |
      Add one SignInPage unit test for AC1. A valid email and password submit calls signIn with those values and shows no error alert. No production code changes.
    files:
      - apps/web/src/auth/SignInPage.test.tsx
    rationale: |
      The existing tests cover only the refused path, an empty password and field presence. The success submit from the form is not asserted at unit level. It is only asserted in Playwright with mocked routes.
  - description: |
      Rename the existing test titles so they are traceable to this story's ACs. The field-presence test is already named for AC3, and the refused-sign-in tests are named for AC2. This is a title-only change, with no logic changes.
    files:
      - apps/web/src/auth/SignInPage.test.tsx
      - apps/web/e2e/auth.spec.ts
    rationale: |
      A reviewer can map the tests to the acceptance criteria without reading the earlier stories.
  - description: |
      No change to SignInPage.tsx, AuthProvider.tsx, authClient.ts or services/api/src/auth/*. Only change them if the new test exposes a real defect.
    files: []
    rationale: |
      The AC behaviour is already implemented and tested. The API e2e (services/api/test/auth.e2e-spec.ts) already covers a valid sign-in with a session cookie (AC1) and a wrong password with a 401, the generic message and no cookie (AC2).
tests:
  - |
    AC1 (new, apps/web/src/auth/SignInPage.test.tsx):
    ```ts
    it("submits a valid email and password and shows no error (AC1)", async () => {
      signIn.mockReset();
      signIn.mockResolvedValue({ ok: true });
      const user = userEvent.setup();
      render(<SignInPage />);
      await user.type(screen.getByLabelText(/email/i), "ada@example.com");
      await user.type(screen.getByLabelText(/password/i), "test-password");
      await user.click(screen.getByRole("button", { name: /sign in/i }));
      expect(signIn).toHaveBeenCalledWith("ada@example.com", "test-password");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
    ```
    Existing backing: API e2e 'signs in, probes the session and signs out' (200, sid HttpOnly cookie) and the Playwright test 'a successful sign-in shows the user as signed in'.
  - |
    AC2 (existing, verify it still passes). SignInPage.test.tsx 'keeps the sign-in form on screen after a refused sign-in' and 'shows exactly the server's generic message', API e2e 'refuses a wrong password without a cookie' (`.expect(401)` and `expect(res.headers['set-cookie']).toBeUndefined()`), and Playwright 'a refused sign-in shows only the generic message'.
  - |
    AC3 (existing, verify it still passes). SignInPage.test.tsx 'shows an email field and a password field on load' with `expect(screen.getByLabelText(/password/i)).toHaveAttribute("type", "password")`.
  - |
    Run `cd apps/web && pnpm vitest run src/auth` and `cd services/api && pnpm jest auth`, and confirm both are green.
assumptions_or_open_questions:
  - |
    The username is the user's email. The User entity and the sign-in API use email, and the form label is "Email". The plan does not rename the label to "Username". If the reviewer wants literal "Username" wording, that is a one-line label change in SignInPage.tsx plus test updates. Please confirm.
  - |
    The story may be a duplicate of the already-delivered STORY-019 sign-in. If the reviewer agrees, the item could be closed with only the added test.
  - |
    The new AC1 test assumes the mocked signIn resolves with an object shaped like `{ ok: true }`. This matches the `result.ok` check in SignInPage.tsx.
estimated_points: 1
package_dependencies: []
notes: |
  ### Data & rollout

  None — test-only change, with no schema, stored data, settings or provisioning.

  The stack follows the confirmed decisions. The web app uses vitest, Testing Library and Playwright. The API uses jest and supertest. No new tooling is added.
review_focus: |
  IN scope: one added unit test and title-only renames of existing tests. OUT of scope: any change to the sign-in UI or API, the Cognito integration, and renaming "Email" to "Username". The reviewer should check that no production code changed, and that the "username equals email" interpretation is acceptable.
