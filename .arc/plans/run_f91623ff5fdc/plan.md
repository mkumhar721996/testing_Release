summary: |
  STORY-019 already shipped most of this story: the API has POST /auth/sign-in (generic refusal), POST /auth/sign-out, GET /auth/session behind SessionGuard with a 30-minute sliding inactivity window, and the web app has AuthProvider, SignInPage and a signed-in Shell with a Sign out button. The one real gap is AC3. The SPA calls GET /auth/session once at page load, so a user who leaves a tab open past the timeout keeps seeing app content until they reload. This plan closes that gap with a client-side inactivity timer plus a session re-check when the tab becomes visible again. It also adds the missing regression tests that pin AC1, 2, 4, 5, 6 and 7 (direct page address, no account-creation option) at unit and Playwright level. No API changes and no new packages.

scope:
  - description: |
      Add inactivity expiry to AuthProvider. While a user is signed in:
      - track user activity (pointerdown, keydown, scroll) and reset a single timer of IDLE_TIMEOUT_MS (30 min, mirrors INACTIVITY_TIMEOUT_MS in services/api/src/auth/auth.constants.ts)
      - when it fires, call client.signOut() (ends the server session and Cognito refresh token) and setUser(null), so Shell renders SignInPage
      - on document visibilitychange to visible, re-run client.getSession(); a null result sets user to null (covers laptop sleep and throttled background timers where the server already expired the session)
      - on activity, if more than KEEPALIVE_MS (5 min) passed since the last server touch, call client.getSession() so the server sliding window follows real use. Without this the server would expire an active user whose SPA makes no API calls.
      The timer must not poll /auth/session on an interval, because SessionGuard.touchIfActive slides the window and polling would keep an idle session alive forever.
      Signature additions in AuthProvider.tsx:
      ```ts
      export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
      export const KEEPALIVE_MS = 5 * 60 * 1000;
      ```
    files:
      - apps/web/src/auth/AuthProvider.tsx
    rationale: |
      AC3 needs the signed-in view to flip to sign-in without a reload. The server stays the authority on expiry (SessionGuard returns 401 session_expired), and the client timer only makes the UI follow it.
  - description: |
      Tests-only changes for the already-working behaviours. Extend AuthProvider.test.tsx with the idle-expiry, visibility and keep-alive cases. Extend App.test.tsx with the sign-in field, no account-creation and direct-address cases. Extend e2e/auth.spec.ts with a Playwright flow for sign-in, sign-out, expiry and direct address, using page.route stubs like the existing refusal test and page.clock for time.
    files:
      - apps/web/src/auth/AuthProvider.test.tsx
      - apps/web/src/App.test.tsx
      - apps/web/src/auth/SignInPage.test.tsx
      - apps/web/e2e/auth.spec.ts
    rationale: |
      AC1, 2, 4, 5, 6 and 7 are met by existing code but only partly asserted. AC6 and AC7 have no test at all today. Pinning them stops later shell and navigation stories (header, People, Leave routes) from regressing them.
  - description: |
      Only if a test fails: minimal fix in the Shell and App for AC6. App renders SignInPage for any path when there is no user, since there is no router yet. No router is introduced here, and the header, navigation and account menu belong to sibling stories.
    files:
      - apps/web/src/App.tsx
    rationale: |
      Expected to need no change. Listed so the reviewer knows App.tsx is the only other candidate file.

tests:
  - |
    AC3 (unit, AuthProvider.test.tsx, written first and failing). Idle timeout signs the user out without a reload.
    ```tsx
    it("signs out after 30 minutes without activity (AC3)", async () => {
      vi.useFakeTimers();
      vi.mocked(client.getSession).mockResolvedValue({ email: "ada@example.com" });
      vi.mocked(client.signOut).mockResolvedValue();
      render(<AuthProvider><Probe /></AuthProvider>);
      expect(await screen.findByText("in:ada@example.com")).toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS));
      expect(client.signOut).toHaveBeenCalledTimes(1);
      expect(screen.getByText("out")).toBeInTheDocument();
    });
    ```
  - |
    AC3 (unit). Activity resets the timer, and a tab returning after server-side expiry shows sign-in.
    ```tsx
    await act(() => vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS - 1000));
    fireEvent.keyDown(document, { key: "a" });
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(screen.getByText("in:ada@example.com")).toBeInTheDocument();

    vi.mocked(client.getSession).mockResolvedValue(null);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    fireEvent(document, new Event("visibilitychange"));
    expect(await screen.findByText("out")).toBeInTheDocument();
    ```
  - |
    AC3 (unit). Activity touches the server at most once per KEEPALIVE_MS and the timer does not poll on its own.
    ```tsx
    await act(() => vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS - 1000)); // no activity
    expect(client.getSession).toHaveBeenCalledTimes(1); // only the initial load probe
    ```
  - |
    AC3 (Playwright, e2e/auth.spec.ts). The stubbed session becomes 401 and the clock is moved past 30 minutes.
    ```ts
    await page.clock.install();
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Web App" })).toBeVisible();
    await page.clock.fastForward("31:00");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    ```
  - |
    AC1 (unit, SignInPage.test.tsx and Playwright). Valid credentials lead into the app.
    ```ts
    // Playwright, with sign-in stubbed 200 and /auth/session flipping from 401 to 200 after it
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Web App" })).toBeVisible();
    ```
  - |
    AC2 (existing e2e, keep). Cognito refusal shows only the generic message and never the raw error.
    ```ts
    await expect(page.getByRole("alert")).toHaveText("Incorrect email or password.");
    ```
    Add a unit assertion in SignInPage.test.tsx that a refusal clears the password field and keeps the email.
  - |
    AC4 (unit App.test.tsx and Playwright). Choosing Sign out shows the sign-in screen.
    ```tsx
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Web App" })).not.toBeInTheDocument();
    ```
  - |
    AC5 (unit App.test.tsx). A signed-out visitor sees the sign-in screen with both fields.
    ```tsx
    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    ```
  - |
    AC6 (unit App.test.tsx, new). Direct page addresses show sign-in and no app content.
    ```tsx
    it.each(["/people", "/leave", "/people/123"])("shows only sign-in at %s when signed out", async (path) => {
      window.history.pushState({}, "", path);
      vi.mocked(client.getSession).mockResolvedValue(null);
      render(<App />);
      expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Web App" })).not.toBeInTheDocument();
      expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument();
    });
    ```
    The same flow runs in Playwright with page.goto("/people") and the session stubbed 401.
  - |
    AC7 (unit App.test.tsx, new). No account-creation option on the sign-in screen.
    ```tsx
    expect(screen.queryByRole("link", { name: /sign up|register|create (an )?account/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign up|register|create (an )?account/i })).not.toBeInTheDocument();
    ```

assumptions_or_open_questions:
  - |
    The server-side behaviour (generic refusal, sign-out, 30-minute sliding window, 401 session_expired) was delivered in STORY-019 and is treated as correct, so this plan makes no API changes. If the reviewer wants API-level regression coverage for AC2, AC3 and AC4 added to services/api/test/auth.e2e-spec.ts, say so. I did not read that file in full, so I would check what it already asserts first.
  - |
    The client idle timer is 30 minutes to match INACTIVITY_TIMEOUT_MS on the API. The two constants are duplicated, not shared, because web and api have no shared package. Is that acceptable, or should the API expose the timeout in GET /auth/session?
  - |
    The keep-alive call on activity (at most once per 5 minutes) is my addition. Without it, a user who is active in the SPA but makes no API calls would be expired by the server at 30 minutes while the client still thinks they are active. Later stories with real API calls would make it redundant but harmless.
  - |
    There is no router yet, so any path shows the sign-in screen for a signed-out visitor, which satisfies AC6. After sign-in the user lands on the single shell view whatever path they opened. Preserving the originally requested address belongs with the navigation and routing story.
  - |
    Account creation, role assignment and the account menu are out of scope per the story, so no change is made there. The Shell's existing Sign out button satisfies AC4 until the header story moves it into the account menu.

estimated_points: 3

package_dependencies: []

notes: |
  Findings from reading the code:
  - services/api/src/auth/auth.controller.ts, auth.service.ts, session.service.ts and session.guard.ts already implement sign-in, sign-out and session sliding.
  - apps/web/src/auth/AuthProvider.tsx probes the session once on mount and has no expiry handling. That is the AC3 gap.
  - SessionGuard slides lastActivityAt on every call, so the client must not poll /auth/session on a timer.

  ```mermaid
  flowchart TD
    Main[main.tsx] --> App[App.tsx]
    App --> AP[AuthProvider.tsx]
    App --> SIP[SignInPage.tsx]
    AP --> AC[authClient.ts]
    SIP --> AP
    AC -->|GET /auth/session| Guard[session.guard.ts]
    AC -->|POST /auth/sign-out| Ctl[auth.controller.ts]
    Guard --> SS[session.service.ts]
    AP -.->|idle timer and visibility re-check, AC3| AP
    classDef touched fill:#f96,color:#000
    class AP touched
    class App touched
  ```
  AuthProvider.tsx is the only production file expected to change. App.tsx is shown because it is the only other candidate if a test fails. Test files are listed in scope and not drawn.

review_focus: |
  IN scope: the web inactivity timer, the visibility re-check and the keep-alive in AuthProvider.tsx, plus tests pinning AC1 to AC7. OUT of scope: any API change, a router, the header and account menu, and roles. The riskiest part is the timer and keep-alive logic, where a polling interval would silently defeat server-side expiry, so check that nothing calls /auth/session on a timer and that effects clean up listeners and timers. Most of the story already shipped in STORY-019, so a small production diff is deliberate.
