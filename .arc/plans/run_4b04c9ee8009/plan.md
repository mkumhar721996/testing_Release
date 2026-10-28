summary: |
  Replace the placeholder signed-in `Shell` in `apps/web/src/App.tsx` with a real app shell following the design system's `app-shell.html` prototype: a left sidebar with the brand and the main navigation (People, Leave as links), a slim top header holding the account menu (signed-in user's email and Sign out), and a routed content area. People and Leave are minimal placeholder screens, because their real contents belong to the Employee management and Leave requests epics. Routing uses `react-router-dom` (the app has no router today): `/people` and `/leave` are signed-in routes and everything else redirects to `/people`. Sign-out reuses `useAuth().signOut`, which clears the user so the app falls back to `SignInPage`. The design tokens in `design-system/tokens.css` are not loaded by the app today, so this plan loads them once in `apps/web/src/index.css` and maps them into the Tailwind theme; every new component is styled only through those mappings. The existing `/shop`, `/activate`, `/reset-password` and `/forgot-password` pathname checks stay untouched. The shell's nav REPLACES the role-based `nav/Navigation` that story 020 mounted in the placeholder (see open question 1). Beyond the five story ACs, derived criteria E1-E8 pin the edge cases. Web app only; no API changes.

scope:
  - description: |
      Load the design tokens once and expose them to Tailwind. In `apps/web/src/index.css` add `@import "../../../design-system/tokens.css";` as the FIRST line (before the `@tailwind` directives; Vite inlines CSS `@import`s). In `apps/web/tailwind.config.ts` (today `theme.extend` is `{}`), extend the theme with token-backed keys so components never write colour or pixel literals:

      ```ts
      theme: {
        extend: {
          colors: {
            bg: "var(--color-bg)", "bg-subtle": "var(--color-bg-subtle)", "bg-inset": "var(--color-bg-inset)",
            fg: "var(--color-fg)", "fg-muted": "var(--color-fg-muted)", "fg-inverse": "var(--color-fg-inverse)",
            primary: "var(--color-primary)", "primary-subtle": "var(--color-primary-subtle)",
            border: "var(--color-border)", "border-strong": "var(--color-border-strong)",
          },
          spacing: { "space-1": "var(--space-1)", "space-2": "var(--space-2)", "space-3": "var(--space-3)",
                     "space-4": "var(--space-4)", "space-5": "var(--space-5)", "space-6": "var(--space-6)" },
          borderRadius: { "radius-md": "var(--radius-md)", "radius-lg": "var(--radius-lg)" },
          fontSize: { "token-xs": "var(--font-size-xs)", "token-sm": "var(--font-size-sm)", "token-md": "var(--font-size-md)",
                      "token-lg": "var(--font-size-lg)", "token-xl": "var(--font-size-xl)" },
          fontFamily: { ui: "var(--font-family-sans)" },
          boxShadow: { "token-md": "var(--shadow-md)" },
        },
      }
      ```

      Keys are namespaced (`space-*`, `radius-*`, `token-*`) so they do not override Tailwind defaults used by existing pages (`rounded`, `text-sm`, `bg-slate-50`).
    files:
      - apps/web/src/index.css
      - apps/web/tailwind.config.ts
    rationale: |
      `index.css` holds only the three `@tailwind` lines and `main.tsx` imports `./index.css`; nothing loads `design-system/tokens.css`. Without this step the new UI would hard-code colours. Additive only: existing pages keep their slate classes. jsdom does not apply CSS, so this is verified by `pnpm run build` and class-name assertions.
  - description: |
      Add `react-router-dom` and wire the signed-in area into routes. In `App.tsx` keep the existing pathname checks (`/activate`, `/reset-password`, `/forgot-password` in `App`, `/shop` in `Shell`) exactly where they are. Replace only the final placeholder `<main>` of `Shell` (the "Web App" heading, `<Navigation role={user.role} />`, "Signed in as", `Shop` link and bare Sign out button) with:

      ```tsx
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/people" element={<PeoplePage />} />
            <Route path="/leave" element={<LeavePage />} />
            <Route path="*" element={<Navigate to="/people" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      ```

      `Shell` no longer needs `signOut` from `useAuth`, and the `./nav/Navigation` import is removed from `App.tsx`.
    files:
      - apps/web/src/App.tsx
      - apps/web/package.json
    rationale: |
      ACs 2 and 3 need navigation between screens from anywhere and no router exists. A layout route guarantees AC1 (same header and nav on every signed-in screen) structurally. The router mounts only after the loading and signed-out guards, so signed-out visitors never see the shell. The catch-all sends `/`, stale URLs and not-yet-built sub-routes to People (E2); epics adding sub-routes register them before it.
  - description: |
      New shell components under `apps/web/src/shell/`, following `design-system/app-shell.html` (sidebar for navigation, slim top bar for the account menu, per `design-system/UI-GUIDELINES.md` "Navigation").

      ```tsx
      export function AppShell(): JSX.Element   // <div class="flex min-h-screen font-ui"> <aside>brand + <MainNav/></aside> <div> <Header/> <main><Outlet/></main> </div> </div>
      export function Header(): JSX.Element     // <header> (role banner) holding <AccountMenu/>, right-aligned
      export function MainNav(): JSX.Element    // <nav aria-label="Main"> NavLink "People" to /people, NavLink "Leave" to /leave
      export function AccountMenu(): JSX.Element
      ```

      `AccountMenu`: a button named "Account" with `aria-expanded` and `aria-haspopup="menu"`; when open, a panel with `role="menu"` shows `user.email` (a `<span>` with `truncate` and `title={email}`) and a `role="menuitem"` button "Sign out" calling `useAuth().signOut`. It closes on Escape (focus returns to the button), on an outside `mousedown`, and when Sign out is chosen. The click handler catches a rejected `signOut()` so no unhandled rejection escapes.

      Tokens used, by Tailwind key (token): AppShell root `bg-bg` (--color-bg), `font-ui` (--font-family-sans); sidebar `bg-bg-subtle` (--color-bg-subtle), `border-r border-border` (--color-border), `p-space-4` and `gap-space-4` (--space-4); brand `text-token-lg` (--font-size-lg), `font-semibold`, `text-fg` (--color-fg); content `p-space-5` (--space-5). MainNav list `gap-space-1` (--space-1); links `px-space-3 py-space-2` (--space-3, --space-2), `rounded-radius-md` (--radius-md), `text-token-sm` (--font-size-sm), `font-medium`, `text-fg-muted` (--color-fg-muted), `hover:bg-bg-inset` (--color-bg-inset), current page `aria-[current=page]:bg-primary-subtle aria-[current=page]:text-primary` (--color-primary-subtle, --color-primary). Header `px-space-5 py-space-3`, `border-b border-border`. AccountMenu button `text-fg`, `px-space-3 py-space-2`, `rounded-radius-md`, `hover:bg-bg-inset`; panel `bg-bg`, `border border-border`, `rounded-radius-lg` (--radius-lg), `shadow-token-md` (--shadow-md), `p-space-2`; email `text-token-sm text-fg-muted`; Sign out `text-token-sm text-fg hover:bg-bg-inset`. Bound the email width with a Tailwind max-width utility on the span (no raw pixel value in a style attribute).
    files:
      - apps/web/src/shell/AppShell.tsx
      - apps/web/src/shell/Header.tsx
      - apps/web/src/shell/MainNav.tsx
      - apps/web/src/shell/AccountMenu.tsx
    rationale: |
      Split per responsibility so each AC maps to one component and one test file. Identity and sign-out come from the existing `useAuth`, so there is no new auth logic. The sidebar sits before the header in the DOM, so Tab order is People, Leave, Account (E8). `MainNav` is a new component and deliberately does not reuse `nav/Navigation`, which renders role-based non-link `<li>` items.
  - description: |
      Make sign-out clear the local session even when the network call fails (E7), in `AuthProvider.tsx`:

      ```tsx
      // before
      const signOut = useCallback(async () => {
        await client.signOut();
        setUser(null);
      }, []);
      // after
      const signOut = useCallback(async () => {
        try {
          await client.signOut();
        } finally {
          setUser(null);
        }
      }, []);
      ```

      The rejection still propagates to the caller; `AccountMenu` catches it.
    files:
      - apps/web/src/auth/AuthProvider.tsx
      - apps/web/src/auth/AuthProvider.test.tsx
    rationale: |
      Today a failed sign-out request leaves the user looking signed in with no feedback, which contradicts AC5 ("no longer signed in"). Small, deliberate change to existing auth code; flagged as an open question.
  - description: |
      Placeholder screens, each rendering one `<h1>` ("People" / "Leave") styled `text-token-xl font-semibold text-fg` (--font-size-xl, --color-fg) and no business content.

      ```tsx
      export function PeoplePage(): JSX.Element
      export function LeavePage(): JSX.Element
      ```
    files:
      - apps/web/src/people/PeoplePage.tsx
      - apps/web/src/leave/LeavePage.tsx
    rationale: |
      ACs 2 and 3 require a People screen and a Leave screen to be shown; real content is owned by other epics, which will replace these files. `<h1>` because the shell's `<main>` is the landmark and the brand is not a heading.
  - description: |
      Update existing tests and e2e that assert the removed placeholder, and add the new ones (written first, see `tests`).

      - `App.test.tsx`: replace "shows who is signed in" (asserts `Signed in as ada@example.com`), "shows the signed-in shell with a sign-out control" (asserts the "Web App" heading and a bare Sign out button) and "lists Admin in the navigation only for an HR admin" (asserts `Admin` in the removed role-based nav). Every signed-in mock session in this file and the new tests carries a `role`, e.g. `{ email: "ada@example.com", role: "employee" }`, matching `SessionUser`.
      - `e2e/auth.spec.ts` "a successful sign-in" test: line 33 asserts `Signed in as ada@example.com`; change it to open the Account menu and assert the email. That test's `**/auth/session` route answers 401 even after sign-in, and `AuthProvider.signIn` re-reads the session, so the route must answer 401 first and 200 `{ user: { id, email, role } }` after the sign-in request is fulfilled (flag variable set in the sign-in route handler).
      - `e2e/access.spec.ts` asserts `Admin` and `Profile` inside the role-based nav; per open question 1 these two tests are rewritten to assert the shell nav shows the People and Leave links.
      - Leave `e2e/shop.spec.ts`, the `/shop` App test and `nav/Navigation.test.tsx` unchanged (the latter still passes because `Navigation.tsx` and `navigation.ts` stay in the repo, unmounted).
    files:
      - apps/web/src/shell/AppShell.test.tsx
      - apps/web/src/shell/MainNav.test.tsx
      - apps/web/src/shell/AccountMenu.test.tsx
      - apps/web/src/App.test.tsx
      - apps/web/e2e/auth.spec.ts
      - apps/web/e2e/access.spec.ts
      - apps/web/e2e/shell.spec.ts
    rationale: |
      TDD per acceptance criterion and edge case. Without the `auth.spec.ts` and `access.spec.ts` changes the existing e2e suite would fail, because the email is now only visible inside the opened menu and the role-based nav is no longer mounted.

tests:
  - |
    AC1 (shell/AppShell.test.tsx, written first, fails because the shell does not exist). Render the routes inside `MemoryRouter` with `vi.mock("../auth/authClient")`, `getSession` resolving `{ email: "ada@example.com", role: "employee" }`, wrapped in `AuthProvider`. For `/people` and `/leave`:
    ```tsx
    expect(await screen.findByRole("banner")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "People" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Leave" })).toBeInTheDocument();
    ```
  - |
    AC2 (AppShell.test.tsx). Start on `/leave`, click People.
    ```tsx
    await user.click(screen.getByRole("link", { name: "People" }));
    expect(screen.getByRole("heading", { name: "People" })).toBeInTheDocument();
    ```
  - |
    AC3 (AppShell.test.tsx). Start on `/people`, click Leave.
    ```tsx
    await user.click(screen.getByRole("link", { name: "Leave" }));
    expect(screen.getByRole("heading", { name: "Leave" })).toBeInTheDocument();
    ```
  - |
    AC4 (AccountMenu.test.tsx). Identity hidden until the menu is opened, then shown.
    ```tsx
    expect(screen.queryByText("ada@example.com")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Account" }));
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    ```
  - |
    AC5 (AccountMenu.test.tsx plus App.test.tsx). Unit: Sign out calls the client. Integration: after clicking, the app shows the sign-in form.
    ```tsx
    await user.click(screen.getByRole("button", { name: "Account" }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(client.signOut).toHaveBeenCalledOnce();
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    ```
  - |
    E1 current page is indicated (MainNav.test.tsx, `MemoryRouter` at `/people`). The current link has `aria-current="page"`, the other does not, and it updates after navigating.
    ```tsx
    expect(screen.getByRole("link", { name: "People" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Leave" })).not.toHaveAttribute("aria-current");
    await user.click(screen.getByRole("link", { name: "Leave" }));
    expect(screen.getByRole("link", { name: "Leave" })).toHaveAttribute("aria-current", "page");
    ```
  - |
    E2 root and unknown paths land on People (App.test.tsx). Covers `/`, `/nope` and `/people/123`; `getSession` resolves a user with a role; the existing `afterEach` resets the pathname to `/`.
    ```tsx
    for (const path of ["/", "/nope", "/people/123"]) {
      window.history.pushState({}, "", path);
      const { unmount } = render(<App />);
      expect(await screen.findByRole("heading", { name: "People" })).toBeInTheDocument();
      expect(window.location.pathname).toBe("/people");
      unmount();
    }
    ```
  - |
    E3 deep link while signed in (App.test.tsx). Opening `/leave` directly shows Leave inside the same shell with Leave as the current link.
    ```tsx
    window.history.pushState({}, "", "/leave");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Leave" })).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Leave" })).toHaveAttribute("aria-current", "page");
    ```
  - |
    E4 no shell while loading, signed out, or on `/activate` (App.test.tsx).
    ```tsx
    vi.mocked(client.getSession).mockReturnValue(new Promise(() => {}));
    render(<App />);
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    // signed out on /leave
    vi.mocked(client.getSession).mockResolvedValue(null);
    window.history.pushState({}, "", "/leave");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    ```
  - |
    E5 account menu open and close (AccountMenu.test.tsx). `aria-expanded` follows state; Escape and an outside click close the menu; Escape returns focus to the button; the menu can be reopened.
    ```tsx
    const button = screen.getByRole("button", { name: "Account" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    await user.click(button);
    await user.click(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    ```
  - |
    E6 sign-out from a non-default screen (App.test.tsx). Signing out on `/leave` removes the header and shows sign-in; the email is gone with it.
    ```tsx
    window.history.pushState({}, "", "/leave");
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Account" }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.queryByText("ada@example.com")).not.toBeInTheDocument();
    ```
  - |
    E7 sign-out request fails. AuthProvider.test.tsx: the existing `Probe` uses `onClick={signOut}`, which would leave an unhandled rejection, so the new case uses a Probe button that swallows it (`onClick={() => signOut().catch(() => {})}`), then asserts the user is cleared. AccountMenu/App level: no unhandled rejection and the sign-in form appears.
    ```tsx
    vi.mocked(client.signOut).mockRejectedValue(new Error("network"));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    ```
  - |
    E8 long identity and keyboard order (AccountMenu.test.tsx for the email, AppShell.test.tsx for Tab order). A very long email is truncated visually and exposes the full value via `title`; Tab reaches People, Leave, then Account.
    ```tsx
    const long = `${"a".repeat(80)}@example.com`;
    // render with session email = long, open the menu
    expect(screen.getByText(long)).toHaveClass("truncate");
    expect(screen.getByText(long)).toHaveAttribute("title", long);
    await user.tab();
    expect(screen.getByRole("link", { name: "People" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Leave" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Account" })).toHaveFocus();
    ```
  - |
    App.test.tsx replacement for the removed placeholder tests: the signed-in render shows the shell and People, and the role-based nav is no longer rendered.
    ```tsx
    vi.mocked(client.getSession).mockResolvedValue({ email: "ada@example.com", role: "hr_admin" });
    render(<App />);
    expect(await screen.findByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "People" })).toBeInTheDocument();
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    ```
    The existing `/shop` test must still pass unchanged (the pathname check precedes the router).
  - |
    E2E (e2e/shell.spec.ts, Playwright). Route `**/auth/session` to 200 `{ user: { id: "u1", email: "ada@example.com", role: "employee" } }` and `**/auth/sign-out` to 204, then walk the ACs including a deep link and browser Back. Also update `e2e/auth.spec.ts` (line 33, plus the stateful session route) and `e2e/access.spec.ts` as described in scope.
    ```ts
    await page.goto("/leave");
    await expect(page.getByRole("heading", { name: "Leave" })).toBeVisible();
    await page.getByRole("link", { name: "People" }).click();
    await expect(page).toHaveURL(/\/people$/);
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Leave" })).toBeVisible();
    await page.getByRole("button", { name: "Account" }).click();
    await expect(page.getByText("ada@example.com")).toBeVisible();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    ```
  - |
    Narrow runs per task, derived from the project test command:
    ```sh
    (cd apps/web && pnpm run test -- src/shell src/App.test.tsx src/auth/AuthProvider.test.tsx src/nav)
    (cd apps/web && pnpm run typecheck && pnpm run build)
    (cd apps/web && pnpm run e2e -- e2e/shell.spec.ts e2e/auth.spec.ts e2e/access.spec.ts)
    ```
    `build` proves the token `@import` and Tailwind theme keys compile.

assumptions_or_open_questions:
  - |
    OPEN QUESTION 1 (found on the current code): story 020 (role-based access) already mounts a role-based `<nav aria-label="Main">` (`nav/Navigation.tsx`, `nav/navigation.ts`) in the placeholder `Shell`, listing Profile/Leave/Team/Employees/Dashboards/Admin per role as plain `<li>` text with no links, covered by `nav/Navigation.test.tsx`, an App test and `e2e/access.spec.ts`. This story requires a main nav with People and Leave links on every screen, and two navs both named "Main" cannot coexist. Default in this plan: the shell nav is exactly People and Leave for every role; `Navigation.tsx`/`navigation.ts` and their unit tests stay in the repo, unmounted; the App "lists Admin" test and the two `access.spec.ts` tests are rewritten. Consequence: HR admins no longer see an Admin entry in the UI until a later story re-adds role-gated items to the shell nav. Please confirm, or say if role-gated items must be kept (for example `MainNav` renders People and Leave plus `navigationFor(role)` extras other than Leave).
  - |
    Note the epic text says two roles (HR admin, manager) while the code has four (`employee`, `manager`, `hr_admin`, `read_only_executive`). This plan does not depend on role beyond the open question above.
  - E1-E8 are derived criteria beyond the story's five formal ACs. Please confirm they are in scope, or strike any you consider speculative.
  - |
    Layout follows `design-system/UI-GUIDELINES.md` (persistent left sidebar for navigation, slim top bar holding the account menu) rather than putting the nav inside the header. The story says "header and main navigation"; both appear on every signed-in screen, so the ACs hold. Say so if you want the nav inside the header bar.
  - Mobile layout is not planned. The guidelines say the sidebar collapses behind a menu button below 768px; no AC covers it. Please confirm it can follow later.
  - |
    The existing `/shop` screen (`ShoppingPage`, pathname check in `Shell`) stays outside the shell and router, unchanged, so it has no header, and the old `Shop` link on the placeholder disappears with the placeholder (nav is limited to People and Leave per the story). Is `/shop` a legacy demo to leave alone, or should it join the shell?
  - |
    The only identity on the session is `user.email` (plus `role`), so the account menu shows the email; no display name exists yet.
  - |
    `react-router-dom` v6 is added since none exists. The alternative is hand-rolled `window.location.pathname` handling like the existing checks; say so if you would rather avoid the dependency.
  - |
    Sign-out failure (E7) decision: clear the local session even if the request fails, because the user asked to leave. Trade-off: a server-side session cookie may survive a failed request. If you prefer to stay signed in and show an error, E7 and the `AuthProvider` change flip accordingly.
  - |
    The tokens file is imported by relative path from outside `apps/web` (`../../../design-system/tokens.css`). Vite inlines CSS `@import`s, so the build should work; the implementer verifies with `pnpm run build` and `pnpm run dev`, and falls back to a Vite `server.fs.allow` entry if dev serving blocks it.
  - Deferred project questions (Cognito user pools per environment and account recovery; session lifetime and password and recovery rules) do not affect this UI-only story. Nothing here sets session duration; session expiry while on a screen is not handled (the session is fetched only on mount).
  - |
    Out of scope, noted not planned: multi-tab sign-out sync. After sign-out the URL is left as is; signing back in returns the user to that path because the router mounts again.
  - Brand text in the sidebar, the prototype shows "Comp Console". Please confirm the product name to display.

estimated_points: 5

package_dependencies:
  - name: react-router-dom
    version: ^6.28.0
    ecosystem: npm
    component_id: comp_web_app
    rationale: |
      Client-side routing between the People and Leave screens inside a shared layout route (`NavLink` sets `aria-current="page"`). `apps/web/package.json` lists no router today. v6 supports React 18.

notes: |
  ### Data & rollout

  None — web UI only: no schema, stored data, seed, env var or setting changes. The only config touched is the Tailwind theme and `index.css` in `apps/web`. Roll back by reverting the change.

  ### Verified against current code

  - `apps/web/src/App.tsx`: `App` checks `/activate`, `/reset-password`, `/forgot-password` before wrapping `Shell` in `AuthProvider`; `Shell` returns null while loading, `SignInPage` when signed out, `ShoppingPage` at `/shop`, otherwise the placeholder `<main>` (heading, `<Navigation role={user.role} />`, "Signed in as", Shop link, Sign out) this plan replaces.
  - `apps/web/src/auth/authClient.ts`: `SessionUser = { email, role }`; `getSession()` maps `data.user.email` and `data.user.role`, or returns null on a non-ok response.
  - `apps/web/src/auth/AuthProvider.tsx`: `signOut` has no error handling today; `signIn` re-reads the session after a successful sign-in.
  - `apps/web/src/nav/Navigation.tsx` and `navigation.ts` (story 020): role-based section labels, no links; the shell stops mounting it (open question 1).
  - `App.test.tsx` mocks `./auth/authClient` and `./shop/shopClient` with `vi.mock`; new tests follow that style. Two existing tests mock a session without `role`, which would crash `navigationFor`; the replacements always supply a role.
  - `e2e/auth.spec.ts` line 33 asserts `Signed in as ada@example.com`, and its session route stays 401 after sign-in; both are fixed here.

  ### Design tokens

  Tokens live in `design-system/tokens.css` (`:root` custom properties; also `tokens.json`; prototype in `design-system/app-shell.html`). Before this change nothing loads them: `apps/web/src/index.css` has only the `@tailwind` directives, `apps/web/src/main.tsx` imports `./index.css`, and `apps/web/tailwind.config.ts` has an empty `theme.extend`. The first scope item adds the `@import` (index.css line 1) and the Tailwind theme mapping; every new component then styles with the mapped keys listed in scope item 3. Existing pages keep their slate classes. Every token this plan needs exists in `tokens.css`, so no raw value is required.

  ```mermaid
  flowchart TD
    Main[main.tsx] --> Css[index.css]
    Main --> App[App.tsx]
    Css --> Tokens[design-system/tokens.css]
    Tw[tailwind.config.ts] -.theme maps tokens.-> Tokens
    App --> AuthProvider[auth/AuthProvider.tsx]
    App --> SignInPage[auth/SignInPage.tsx]
    App --> Shopping[shop/ShoppingPage.tsx]
    App -.no longer mounts.-> OldNav[nav/Navigation.tsx]
    App --> AppShell[shell/AppShell.tsx]
    AppShell --> MainNav[shell/MainNav.tsx]
    AppShell --> Header[shell/Header.tsx]
    Header --> AccountMenu[shell/AccountMenu.tsx]
    AccountMenu -->|useAuth signOut| AuthProvider
    AppShell --> People[people/PeoplePage.tsx]
    AppShell --> Leave[leave/LeavePage.tsx]
    classDef touched fill:#f96,color:#000
    class Css,Tw,App,AuthProvider,AppShell,Header,MainNav,AccountMenu,People,Leave touched
  ```
  Touched nodes are highlighted. `index.css` and `tailwind.config.ts` load and map the tokens; `App.tsx` gets the router and layout route and drops the old nav; `AuthProvider.tsx` gets only the try/finally in `signOut` (E7); the shell and page files are new. `SignInPage`, `ShoppingPage` and `nav/Navigation.tsx` are untouched context.

review_focus: |
  IN scope: sidebar nav (People, Leave links), top header with the account menu (email and sign-out), routing, placeholder People and Leave pages, token loading and Tailwind mapping, and derived criteria E1-E8, all in apps/web. OUT: real People/Leave content, API changes, session expiry, mobile collapse, the `/shop` screen, and any change to sign-in or activation. Riskiest parts: replacing story 020's mounted role-based `Navigation` (the Admin entry disappears from the UI, open question 1), the router integration in `App.tsx` next to the existing pathname checks, the deliberate `AuthProvider.signOut` try/finally that clears the user even if the request fails, and the `index.css` token `@import` from outside `apps/web`. Old placeholder assertions in `App.test.tsx`, `e2e/auth.spec.ts` and `e2e/access.spec.ts` are intentionally replaced, and Sign out is a `menuitem` inside the account menu.
