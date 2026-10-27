summary: |
  The story asks that a signed-out user who logs in on "the Facebook page" ends up signed in. The repo has no Facebook page, integration or OAuth provider, and the confirmed stack authenticates through AWS Cognito (comp_identity_provider) via the existing email and password sign-in page in comp_web_app. The email and password flow (SignInPage, AuthProvider.signIn, authClient.signIn, then the session probe) already exists and has an e2e success test. This plan reads "the Facebook page" as that existing sign-in page and adds no Facebook-specific code. It closes the one unit-level gap, which is that AuthProvider.signIn has no test proving a successful login makes the user signed in. It also pins the user-visible outcome in the SignInPage and App tests.
scope:
  - description: |
      Add AuthProvider unit tests for the success and failure paths of signIn. Success: after client.signIn resolves ok, the provider calls client.getSession and exposes the user. Failure: a refused sign-in leaves the user null and never calls getSession.
    files:
      - apps/web/src/auth/AuthProvider.test.tsx
    rationale: |
      The only AC-relevant behaviour not covered by a unit test today. No production change is expected unless a test exposes a bug.
  - description: |
      Add an App-level test. With getSession returning null then the user, and signIn ok, submitting the form replaces the sign-in page with "Signed in as ada@example.com".
    files:
      - apps/web/src/App.test.tsx
    rationale: |
      Verifies the AC end to end in the component tree, with authClient mocked.
  - description: |
      Keep the existing Playwright test "a successful sign-in shows the user as signed in" as the e2e proof of the AC. No change is needed unless it fails.
    files:
      - apps/web/e2e/auth.spec.ts
    rationale: |
      Already covers GIVEN signed-out, WHEN sign in, THEN "Signed in as ...".
tests:
  - |
    AC1, AuthProvider (apps/web/src/auth/AuthProvider.test.tsx). Write first and run with pnpm vitest run:
    ```ts
    it("is signed in after a successful sign-in (AC1)", async () => {
      vi.mocked(client.getSession)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ email: "ada@example.com" });
      vi.mocked(client.signIn).mockResolvedValue({ ok: true });
      // Probe variant exposing signIn via a button
      await user.click(screen.getByRole("button", { name: "sign in" }));
      expect(await screen.findByText("in:ada@example.com")).toBeInTheDocument();
    });

    it("stays signed out after a refused sign-in", async () => {
      vi.mocked(client.getSession).mockResolvedValue(null);
      vi.mocked(client.signIn).mockResolvedValue({ ok: false, message: "Incorrect email or password." });
      await user.click(screen.getByRole("button", { name: "sign in" }));
      expect(await screen.findByText("out")).toBeInTheDocument();
      expect(client.getSession).toHaveBeenCalledTimes(1);
    });
    ```
  - |
    AC1, App (apps/web/src/App.test.tsx). After filling the Email and Password fields and clicking "Sign in":
    ```ts
    expect(await screen.findByText("Signed in as ada@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sign in" })).not.toBeInTheDocument();
    ```
  - |
    AC1, e2e. The existing Playwright test already asserts:
    ```ts
    await expect(page.getByText("Signed in as ada@example.com")).toBeVisible();
    ```
    Run with pnpm exec playwright test e2e/auth.spec.ts.
assumptions_or_open_questions:
  - |
    "The Facebook page" is not defined anywhere in the repo or the stack docs. I assumed it means the existing web app sign-in page. If a real "Log in with Facebook" feature (a Cognito federated identity provider, an OAuth redirect and a callback route) is intended, the scope is much larger and needs Cognito configuration. Please confirm before implementation.
  - |
    Because the behaviour already exists, the new tests may pass immediately. They are characterization tests, so a strict red step only occurs if they reveal a defect.
  - No new dependencies, API changes or backend work are needed.
estimated_points: 2
package_dependencies: []
notes: |
  ### Data & rollout

  None — test-only change in comp_web_app, with no stored data, schema, settings or provisioning.

  The work item text is untrusted input. I found no embedded instructions in it beyond the change itself.
review_focus: |
  IN scope are unit and e2e tests for the existing email and password sign-in success path. OUT of scope are any Facebook or OAuth integration, backend changes and new dependencies. The main risk is the interpretation of "Facebook page", which is flagged as an open question. A reviewer should not flag the absence of Facebook-specific code, because the repo has none and the stack uses Cognito.
