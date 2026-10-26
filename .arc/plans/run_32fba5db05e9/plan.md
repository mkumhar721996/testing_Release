summary: |
  The sign-in flow this story asks for already exists from STORY-019. The Web App has `SignInPage`, `AuthProvider` and `authClient`. The API Service has `POST /auth/sign-in`, which authenticates through Cognito and sets an HttpOnly `sid` cookie. What is missing is test coverage for the single happy path in this story's AC: a user enters valid credentials on the form, submits, and ends up logged in. The API e2e already covers sign-in success at the HTTP level. The Web App only has tests for the refused sign-in and for the already-signed-in shell. This plan adds those missing web tests, in TDD order, and changes production code only if one of them fails.
scope:
  - description: |
      Add a vitest integration test that renders the real `App`, `AuthProvider` and `SignInPage`, mocking only `./auth/authClient`. It starts signed out, fills the form, submits, and expects the signed-in shell. Add it to the existing `describe("App")` block.
    files:
      - apps/web/src/App.test.tsx
    rationale: |
      `SignInPage.test.tsx` mocks `useAuth`, and the other `App` test starts already signed in. Nothing yet proves the submit, then `AuthProvider.signIn`, then session refetch, then shell chain.
  - description: |
      Add a Playwright e2e that stubs `**/auth/session` with 401 on the first call and with `{ user: { email } }` after sign-in. It also stubs `**/auth/sign-in` with 200 `{ status: "signed_in", user }`. It fills Email and Password, clicks "Sign in", and expects the "Signed in as ..." text and a "Sign out" button.
    files:
      - apps/web/e2e/auth.spec.ts
    rationale: |
      Verifies the AC end to end in a real browser, in the same route-stub style as the existing refused-sign-in test.
  - description: |
      Production code stays unchanged unless the tests above expose a defect. If so, make the minimal fix in `AuthProvider.signIn` or `SignInPage`.
    files:
      - apps/web/src/auth/AuthProvider.tsx
      - apps/web/src/auth/SignInPage.tsx
    rationale: |
      This is the contingency path only. No change is expected, because the code reads as correct.
tests:
  - |
    AC1, unit and integration, in `apps/web/src/App.test.tsx`:

    ```tsx
    it("signs the user in after submitting valid credentials", async () => {
      vi.mocked(client.getSession)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ email: "ada@example.com" });
      vi.mocked(client.signIn).mockResolvedValue({ ok: true });
      const user = userEvent.setup();
      render(<App />);
      await user.type(await screen.findByLabelText(/email/i), "ada@example.com");
      await user.type(screen.getByLabelText(/password/i), "test-password");
      await user.click(screen.getByRole("button", { name: /sign in/i }));
      expect(client.signIn).toHaveBeenCalledWith("ada@example.com", "test-password");
      expect(await screen.findByText("Signed in as ada@example.com")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    });
    ```

    This needs `import userEvent from "@testing-library/user-event"`. Check the `SignInResult` success shape in `apps/web/src/auth/authClient.ts` before writing the mock value. Because the code already exists, this may pass on first run. In that case, prove the test is not vacuous by temporarily making `AuthProvider.signIn` skip `setUser` and confirming the test fails, then revert.
  - |
    AC1, e2e, in `apps/web/e2e/auth.spec.ts`:

    ```ts
    test("valid credentials sign the user in", async ({ page }) => {
      let signedIn = false;
      await page.route("**/auth/session", (r) =>
        signedIn
          ? r.fulfill({ status: 200, json: { email: "ada@example.com" } })
          : r.fulfill({ status: 401, json: { code: "session_expired" } }),
      );
      await page.route("**/auth/sign-in", (r) => {
        signedIn = true;
        return r.fulfill({ status: 200, json: { status: "signed_in" } });
      });
      await page.goto("/");
      await page.getByLabel("Email").fill("ada@example.com");
      await page.getByLabel("Password").fill("test-password");
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.getByText("Signed in as ada@example.com")).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    });
    ```

    The stubbed session body and sign-in response shapes must match what `authClient.getSession` and `authClient.signIn` parse. Confirm them in `apps/web/src/auth/authClient.ts` first.
  - |
    Regression, no new test: the existing API e2e `signs in, probes the session and signs out (AC3, AC4, AC8)` in `services/api/test/auth.e2e-spec.ts` already covers the server half of the AC. Run it unchanged with `cd services/api && pnpm test:e2e`.
assumptions_or_open_questions:
  - |
    The story text says "Amazon shopping page". Nothing in this repository is a shopping page. The architecture docs describe a role-based business dashboard Web App that authenticates through Cognito. I assumed the intended target is this project's existing Web App sign-in form, and that "username" means the email address, which is the form's only identifier field. If a separate Amazon shopping page or a distinct username field is really wanted, that is a new feature and the plan needs rework.
  - |
    The login capability was delivered by TESTING-RELEASE-STORY-019 (commit a2b70ac). I treated this story as a test-coverage gap rather than new feature work. If the reviewer expects new behaviour, such as redirects or remember-me, please say so.
  - |
    The exact response shapes of `authClient.signIn` and `getSession` were not re-read in full while planning. The implementer should confirm them before writing the mocks and stubs.
estimated_points: 2
package_dependencies: []
notes: |
  ### Data & rollout

  None — tests only, with no schema, stored data, settings or provisioning changes.

  Existing code reviewed: `apps/web/src/auth/SignInPage.tsx`, `AuthProvider.tsx`, `App.tsx`, `App.test.tsx`, `SignInPage.test.tsx`, `apps/web/e2e/auth.spec.ts` and `services/api/test/auth.e2e-spec.ts`.

  Stack for this work: `comp_web_app` uses vitest for unit tests and playwright for e2e, with pnpm. Run `cd apps/web && pnpm test` and `pnpm exec playwright test`, or whichever scripts `apps/web/package.json` defines.
review_focus: |
  IN scope is happy-path sign-in test coverage in the Web App (vitest integration plus Playwright e2e). OUT of scope are any new login features, any API changes, and any "Amazon shopping page" UI, which does not exist in this repository. The main risk is vacuous tests, since the feature already exists and the new tests may pass immediately. Check that they assert the signed-in shell after submit, with the session refetch sequenced signed out first and signed in second. Production files are listed only as a contingency and should show no diff unless a test exposed a real bug.
