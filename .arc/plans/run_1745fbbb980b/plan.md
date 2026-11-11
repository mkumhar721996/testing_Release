summary: |
  The single acceptance criterion (a login option is shown once the page finishes loading) is already met by the existing Web App. `Shell` in `apps/web/src/App.tsx` renders `SignInPage` when `useAuth()` reports no user and loading is done. This plan therefore adds no production code. It adds two regression tests that pin the criterion explicitly, covering the "login option shown after load finishes" behaviour at unit level (vitest) and at browser level (playwright). Existing tests only check the "Sign in" heading or start from a form that is already visible.
scope:
  - description: |
      Add a vitest case to `App.test.tsx` that holds `getSession` pending, asserts no login option is shown while loading, then resolves it with `null` and asserts the login option (email field, password field and a "Sign in" submit button) is shown.
    files:
      - apps/web/src/App.test.tsx
    rationale: |
      The existing "shows the sign-in form when signed out" test only checks the heading. The AC is about the state after loading finishes, so the loading to loaded transition should be pinned.
  - description: |
      Add a playwright test to `auth.spec.ts` that mocks `**/auth/session` with 401, loads `/`, and asserts the sign-in button is visible. No form interaction is needed.
    files:
      - apps/web/e2e/auth.spec.ts
    rationale: |
      Verifies the AC end to end in a real browser on page load. The existing e2e tests only reach the form as a precondition for submitting it.
tests:
  - |
    AC1, unit (apps/web/src/App.test.tsx). Written first. It is expected to pass immediately because the behaviour already exists, so confirm it can fail by temporarily returning null from the signed-out branch of Shell.
    ```tsx
    it("shows a login option once loading finishes", async () => {
      let resolve!: (v: null) => void;
      vi.mocked(client.getSession).mockReturnValue(new Promise((r) => (resolve = r)));
      render(<App />);
      expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument();
      resolve(null);
      expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      expect(screen.getByLabelText("Password")).toBeInTheDocument();
    });
    ```
  - |
    AC1, e2e (apps/web/e2e/auth.spec.ts).
    ```ts
    test("the login option is shown when the page finishes loading", async ({ page }) => {
      await page.route("**/auth/session", (r) =>
        r.fulfill({ status: 401, json: { code: "session_expired" } }),
      );
      await page.goto("/");
      await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    });
    ```
assumptions_or_open_questions:
  - |
    The story says "facebook page", but nothing in the repo or the architecture docs mentions Facebook or social login. The stack uses Cognito email and password sign-in. I treated "the Facebook page" as this project's Web App landing page. If Facebook social login (a Cognito federated identity provider) is actually wanted, that is a separate and larger change that needs a new story and an ADR.
  - |
    The criterion is already satisfied by existing code (the sign-in and account activation work merged earlier, #11). If the reviewer prefers, this item can be closed as already done and the two regression tests dropped.
estimated_points: 1
package_dependencies: []
notes: |
  ### Data & rollout

  None — tests only, no stored data, schema, settings or provisioning.

  Verification commands, run from `apps/web`: `pnpm vitest run src/App.test.tsx` and `pnpm playwright test e2e/auth.spec.ts`. Both use the existing tooling for `comp_web_app` (vitest and playwright).
review_focus: |
  IN scope: two regression tests only. OUT of scope: any production code change and any Facebook or social-login integration. The change is deliberately test-only because `Shell` already renders `SignInPage` after loading, so a reviewer should not expect a failing-first test or an implementation diff. The one judgement call is reading "Facebook page" as this project's Web App.
