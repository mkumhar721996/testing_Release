summary: |
  The credential sign-in flow this story describes already exists in the repo, delivered by earlier items (STORY-019, STORY-046, STORY-057). The API has `POST /auth/sign-in` (`AuthController.signIn` calling `AuthService.signIn`, backed by Cognito and a session cookie). The web app has `SignInPage`, `AuthProvider` and `App.tsx`, which renders "Signed in as <email>". The API e2e spec and a Playwright spec already cover the happy path. This plan therefore adds no feature code. It closes the one remaining test gap for the acceptance criterion: the `SignInPage` unit tests only cover refused sign-ins and never assert the happy-path submit. It also records that the story's "username" is the account email.
scope:
  - description: |
      Add one happy-path unit test to `SignInPage.test.tsx` for the submit with valid credentials. It mocks `signIn` to resolve `{ ok: true }`. It asserts `signIn` is called with the typed email and password and that no error alert is shown. The existing component should already pass, so write the test first and confirm it is green. If it is not, make the minimal fix in `SignInPage.tsx`.
    files:
      - apps/web/src/auth/SignInPage.test.tsx
    rationale: |
      AC1 ("submits the login form with valid credentials, user is logged in") has API e2e and Playwright coverage but no component-level success test.
  - description: |
      No change to the API. `services/api/test/auth.e2e-spec.ts` ('signs in, probes the session and signs out') already asserts a 200 `signed_in` response and the session cookie for valid credentials. The plan only re-runs it as verification.
    files: []
    rationale: |
      Avoids duplicating existing coverage and keeps the change inside the AC.
tests:
  - |
    Web unit test, written first, in apps/web/src/auth/SignInPage.test.tsx:
    ```ts
    it("submits the typed credentials and shows no error on success (AC1)", async () => {
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
  - |
    Regression run of the existing end-to-end coverage for AC1. No new code is expected.
    ```
    cd apps/web && pnpm vitest run src/auth src/App.test.tsx
    cd apps/web && pnpm playwright test e2e/auth.spec.ts
    cd services/api && pnpm jest --config test/jest-e2e.json test/auth.e2e-spec.ts
    ```
assumptions_or_open_questions:
  - |
    "Username" in the story is treated as the account email, which is the identifier the existing sign-in uses (`AuthService.signIn(email, password)`; the e2e spec calls it an "unregistered username"). A separate username field would be a new feature and is out of scope. Please confirm.
  - |
    The user is "logged in" as defined by the existing behaviour. The API sets the session cookie and returns `signed_in`, and the web app shows "Signed in as <email>". No post-login redirect or dashboard is added.
  - |
    The sign-in feature is assumed to work as merged. If the verification runs above fail, fixing that regression becomes in scope.
estimated_points: 1
package_dependencies: []
notes: |
  ### Data & rollout

  None — test-only addition, no schema, stored data, settings or provisioning changes.

  Research: `services/api/src/auth/auth.controller.ts` (`POST /auth/sign-in`), `auth.service.ts`, `apps/web/src/auth/SignInPage.tsx`, `apps/web/src/App.tsx`, `apps/web/e2e/auth.spec.ts` and `services/api/test/auth.e2e-spec.ts` already implement and test the flow. The stack is unchanged: React and vitest for the web app, NestJS and jest for the API, Cognito as the identity provider.
review_focus: |
  IN scope: a single added vitest case for the SignInPage success submit. OUT of scope: any feature code, a separate username field, redirects, and API changes. The main thing to check is that no production code was changed without a failing test. The plan deliberately treats the story as already implemented and treats "username" as the email.
