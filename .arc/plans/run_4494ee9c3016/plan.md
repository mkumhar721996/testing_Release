summary: |
  Build the employee directory end to end: a new `employees` table and read-only `GET /employees` endpoint in the NestJS API (session-guarded, case-insensitive search on name and work email, combined with a status filter, plus per-tab counts), and a React directory page in the web app that follows the approved prototype (title + HR-only "Add employee" button, search field, All/Active/On leave/Inactive tabs with counts, dense table that becomes stacked cards below 768px, skeleton loading, "No employees match" state that keeps search and tabs on screen, and a separate "No employees yet" screen with an HR-only "Add employee" action). The repo has no roles and no employee record today, so the plan also adds a minimal `role` (hr_admin | manager) on the existing user and returns it from the session probe; the UI uses it only to show or hide the Add action. Adding, profile and editing stay out of scope.
scope:
  - description: |
      API: add a `role` column to the existing User entity and return it from sign-in and the session probe.
      Before -> after:
      `export type UserStatus = 'pending' | 'active';` gains
      `export type UserRole = 'hr_admin' | 'manager';` and `@Column({ type: 'varchar', default: 'manager' }) role!: UserRole;`
      `SessionGuard` sets `req.user = { id, email, role }`; `AuthController.session()` and `AuthService.signIn()` return `user: { id, email, role }`.
      The existing auth e2e test asserts `user: { id, email }` with toEqual, so it must be updated to include role.
    files:
      - services/api/src/auth/entities/user.entity.ts
      - services/api/src/auth/session.guard.ts
      - services/api/src/auth/auth.service.ts
      - services/api/src/auth/auth.controller.ts
      - services/api/test/auth.e2e-spec.ts
    rationale: |
      The story distinguishes HR admin from manager (ACs 1, 2, 9, 10, 11) but nothing in the code models a role. The smallest change that supports it is one column on the user, defaulting to the least-privileged value (manager).
  - description: |
      API: new `employees` module with an Employee entity, a service and a read-only controller.
      Entity: `id uuid`, `name`, `email` (work email, unique), `role` (job title), `department`, `status: 'active' | 'on_leave' | 'inactive'` (only name, email and status are required by the ACs; role and department are columns because the prototype table shows them).
      Controller: `@Controller('employees') @UseGuards(SessionGuard) class EmployeesController { @Get() list(@Query('q') q?: string, @Query('status') status?: string): Promise<EmployeeListResponse> }`
      Response shape: `{ employees: EmployeeDto[]; counts: { all: number; active: number; on_leave: number; inactive: number }; total: number }`.
      `total` is the unfiltered row count so the client can tell "no employees yet" from "no employees match". `counts` follow the search but ignore the status tab (prototype: tab counts update with the search).
      Service: `list(q, status)` trims q, escapes `%`, `_` and `\` before using `ILIKE`, and matches `name ILIKE :p OR email ILIKE :p` (substring, case-insensitive). An unknown status value returns 400. Results are ordered by name.
      Both roles can read; no role check on this endpoint.
    files:
      - services/api/src/employees/entities/employee.entity.ts
      - services/api/src/employees/employees.service.ts
      - services/api/src/employees/employees.controller.ts
      - services/api/src/employees/employees.module.ts
      - services/api/src/employees/employees.service.spec.ts
      - services/api/test/employees.e2e-spec.ts
      - services/api/src/app/app.module.ts
    rationale: |
      Mirrors the existing auth module layout (entities/, service, controller, module, spec next to source, e2e under test/). The module is added to AppModule imports; entities load through `autoLoadEntities` and `synchronize` outside production, as the User entity does today.
  - description: |
      Web: extend the auth client and provider so the signed-in user carries a role.
      `getSession(): Promise<{ email: string; role: 'hr_admin' | 'manager' } | null>` and `AuthContextValue.user: { email: string; role: Role } | null`.
      Update the existing AuthProvider test mocks (`{ email: "ada@example.com" }`) to include role so typecheck keeps passing.
    files:
      - apps/web/src/auth/authClient.ts
      - apps/web/src/auth/AuthProvider.tsx
      - apps/web/src/auth/AuthProvider.test.tsx
    rationale: |
      The directory needs the role to decide whether to render the Add action. The provider already owns the session user, so the role belongs there.
  - description: |
      Web: employees data layer.
      `employeesClient.ts` exports `type EmployeeStatus = "active" | "on_leave" | "inactive"`, `type Employee`, `type EmployeeList = { employees: Employee[]; counts: Record<"all" | EmployeeStatus, number>; total: number }` and `listEmployees(params: { q: string; status: "all" | EmployeeStatus }, signal?: AbortSignal): Promise<EmployeeList>` using `fetch(`${base()}/employees?...`, { credentials: "include", signal })`, the same pattern as `getSession`.
      A non-OK response throws so the page can show an `.alert` error line (voice: states the fix, e.g. "Could not load employees. Refresh the page to try again.").
    files:
      - apps/web/src/employees/employeesClient.ts
    rationale: |
      Keeps fetch details out of the component, same split as `authClient.ts`.
  - description: |
      Web: directory page and its parts, following the approved prototype "Employee directory" and "Employee directory, no employees" screens.
      `EmployeeDirectoryPage({ role }: { role: Role })`: state `{ q, status }`; debounced (150 ms, as the prototype) fetch through `listEmployees`, with an AbortController so a stale response never overwrites a newer one (prototype uses a token for the same reason).
      Layout from the prototype, built with Tailwind utilities mapped to the design tokens:
      - Toolbar: `h1` "Employees" (24px semibold) left, `Add employee` `.btn-primary` with plus icon right, rendered only when `role === "hr_admin"`, min height 44px.
      - Search: labelled input (visually-hidden label "Search employees by name or email", placeholder "Search by name or email", `type=search`, search icon inside at left, max width 420px, min height 44px).
      - Tabs: `role="tablist"` aria-label "Employee status", four `role="tab"` buttons All, Active, On leave, Inactive, each with a count span, selected tab in primary colour with a 2px bottom border, ArrowLeft/ArrowRight move and select, roving tabindex, min height 44px, horizontally scrollable.
      - Results area (bordered, 8px radius): native `<table>` with columns Name, Role, Department, Status. The Name cell has a 32px initials avatar, name in semibold and work email in 12px muted text. Status is a `.badge` with icon and label: Active = success + check, On leave = warning + calendar, Inactive = neutral + minus. Compact `space-2`/`space-3` cell padding. Below 768px the table hides and a `<ul aria-label="Employees">` of stacked cards shows (name, role and department, badge).
      - Loading: four skeleton rows (table) / two skeleton cards, `aria-busy="true"` on the results container.
      - No match (`total > 0` and the filtered list is empty): in place of the table, `.empty-state` with search icon, bold "No employees match", hint "Check the spelling, search by email, or choose another status tab.", and a secondary "Clear search and show All" button that resets q and status and refocuses the search input. Search field and tabs stay mounted.
      - No employees (`total === 0`): replaces search, tabs and table (prototype: nothing to search yet) with an empty state with user icon and "No employees yet". HR admin sees the hint "Add the first employee so the directory and Leave have someone to refer to." and an "Add employee" primary button. Manager sees "HR admins add employees. They will appear here once added." and no button.
      - A polite live region (`role="status"`) under the results announces "N employees listed" or "No employees match".
      Row names are rendered as plain text for now (profile is another story); the Add buttons call an optional `onAddEmployee?: () => void` prop that nothing passes yet.
    files:
      - apps/web/src/employees/EmployeeDirectoryPage.tsx
      - apps/web/src/employees/StatusBadge.tsx
      - apps/web/src/employees/StatusTabs.tsx
      - apps/web/src/employees/EmployeeResults.tsx
      - apps/web/src/employees/EmployeeDirectoryPage.test.tsx
      - apps/web/e2e/directory.spec.ts
    rationale: |
      One page component owns query state; tabs, badge and results are small presentational parts so each can be tested through the page. The "no employees" vs "no match" split is decided by the API's unfiltered `total`, never by the filtered list, so a search can never turn into the first-run screen.
  - description: |
      Web: wire the directory into the signed-in shell and load design tokens.
      In `App.tsx`, replace the placeholder signed-in `<main>` with the app shell from the prototype (left sidebar with Dashboard, Records, Tasks, Reports, Audit Log, Admin, with Records marked `aria-current="page"` and hosting the directory; slim top bar with global search, notifications and account/sign-out; sidebar collapses behind a menu button below 768px; footer line) and render `EmployeeDirectoryPage role={user.role}` as the main content. Sign-out stays reachable (existing behaviour).
      Import `design-system/tokens.css` values into Tailwind via `theme.extend` (colors, spacing, radius, font sizes) in `tailwind.config.ts`, or a `@import` of tokens.css in `index.css` plus `var(--token)` arbitrary values; pick whichever the repo already uses once implementation checks `design-system/` (see open questions).
    files:
      - apps/web/src/App.tsx
      - apps/web/src/App.test.tsx
      - apps/web/src/index.css
      - apps/web/tailwind.config.ts
    rationale: |
      The only signed-in screen today is a placeholder; the directory needs a home that matches the prototype shell. No router is introduced (the app only branches on pathname for /activate), because the other nav sections do not exist yet and their links are inert.
tests:
  - |
    AC1 (HR admin, All tab) - web, `EmployeeDirectoryPage.test.tsx`, mocking `./employeesClient`:
    ```ts
    vi.mocked(listEmployees).mockResolvedValue(listOf(ava_active, priya_onLeave, maria_inactive));
    render(<EmployeeDirectoryPage role="hr_admin" />);
    for (const [name, label] of [["Ava Chen", "Active"], ["Priya Shah", "On leave"], ["Maria Lopez", "Inactive"]]) {
      const row = (await screen.findByRole("row", { name: new RegExp(name) }));
      expect(within(row).getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole("tab", { name: /^All/ })).toHaveAttribute("aria-selected", "true");
    ```
    API side, `employees.e2e-spec.ts`: seed three employees, signed in as hr_admin, `const res = await agent.get('/employees').expect(200); expect(res.body.employees.map((e) => e.status).sort()).toEqual(['active', 'inactive', 'on_leave']);`
  - |
    AC2 (manager, All tab) - same assertions with `render(<EmployeeDirectoryPage role="manager" />)`; e2e signs in as a user with `role: 'manager'` and expects the same 200 body with all three employees (`expect(res.body.employees).toHaveLength(3)`).
  - |
    AC3 (search by name) - API: `const res = await agent.get('/employees').query({ q: 'Maria Lopez' }).expect(200); expect(res.body.employees.map((e) => e.name)).toEqual(['Maria Lopez']);` Web: typing into the search field calls the client with the typed value:
    ```ts
    await user.type(screen.getByRole("searchbox", { name: /search employees/i }), "Maria Lopez");
    await waitFor(() => expect(listEmployees).toHaveBeenLastCalledWith({ q: "Maria Lopez", status: "all" }, expect.anything()));
    ```
  - |
    AC4 (search by work email) - API: `agent.get('/employees').query({ q: 'm.lopez@example.com' })` returns exactly `[ 'm.lopez@example.com' ]` from `res.body.employees.map((e) => e.email)`. Service spec also asserts that `_` and `%` in q are escaped, e.g. `q: 'm_lopez'` does not match `m.lopez@example.com`.
  - |
    AC5 (case-insensitive name) - API: `agent.get('/employees').query({ q: 'MARIA LOPEZ' })` then `expect(res.body.employees.map((e) => e.name)).toContain('Maria Lopez');`
  - |
    AC6 (case-insensitive email) - API: `agent.get('/employees').query({ q: 'M.LOPEZ@EXAMPLE.COM' })` then `expect(res.body.employees.map((e) => e.email)).toEqual(['m.lopez@example.com']);`
  - |
    AC7 (Active tab + inactive match) - API: `agent.get('/employees').query({ q: 'Maria Lopez', status: 'active' })` gives `expect(res.body.employees).toEqual([])` and `expect(res.body.total).toBe(2)`. Web: the mocked client returns `{ employees: [], total: 2, counts }` and `expect(await screen.findByText("No employees match")).toBeInTheDocument();`. Playwright `directory.spec.ts` stubs `**/employees**`, clicks the Active tab, searches "Maria Lopez" and expects the same line.
  - |
    AC8 (status tabs) - API: for each of `active`, `on_leave`, `inactive`, `agent.get('/employees').query({ status })` and `expect(res.body.employees.every((e) => e.status === status)).toBe(true)`; also `agent.get('/employees').query({ status: 'bogus' }).expect(400)`. Web: `await user.click(screen.getByRole("tab", { name: /^On leave/ })); expect(listEmployees).toHaveBeenLastCalledWith({ q: "", status: "on_leave" }, expect.anything());` and the tab count assertion `expect(screen.getByRole("tab", { name: "Active 5" })).toBeInTheDocument()`.
  - |
    AC9 (empty company, HR admin) - web: `mockResolvedValue({ employees: [], total: 0, counts })`, `render(<EmployeeDirectoryPage role="hr_admin" />)`, `expect(await screen.findByRole("button", { name: "Add employee" })).toBeInTheDocument();` and `expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();`
  - |
    AC10 (empty company, manager text) - web: `render(<EmployeeDirectoryPage role="manager" />)` with the same empty response, `expect(await screen.findByText("No employees yet")).toBeInTheDocument();`
  - |
    AC11 (empty company, manager has no button) - web: `expect(await screen.findByText("No employees yet")).toBeInTheDocument(); expect(screen.queryByRole("button", { name: /add employee/i })).not.toBeInTheDocument();` Playwright: with the session stub returning `role: 'manager'` and `/employees` returning `total: 0`, the same assertions.
  - |
    AC12 (no match replaces the table) - web: `mockResolvedValue({ employees: [], total: 3, counts })`, `expect(await screen.findByText("No employees match")).toBeInTheDocument(); expect(screen.queryByRole("table")).not.toBeInTheDocument();`
  - |
    AC13 (search and tabs stay) - web, same state as AC12: `expect(screen.getByRole("searchbox", { name: /search employees/i })).toBeVisible(); expect(screen.getAllByRole("tab")).toHaveLength(4);` and after clicking "Clear search and show All" the search value is empty and the All tab is selected.
  - |
    Supporting - session role: extend the auth e2e so `agent.get('/auth/session')` returns `{ user: { id, email, role } }` and `expect(res.body.user.role).toBe('hr_admin')` for a seeded HR user; `AuthProvider.test.tsx` mock includes role; `App.test.tsx` asserts the signed-in shell shows the "Records" nav link with `aria-current="page"` and the Employees heading.
assumptions_or_open_questions:
  - |
    Roles: no role exists in the code today. I assume exactly two values, `hr_admin` and `manager`, stored on the user row, defaulting to `manager`. How a user becomes an HR admin (seed, Cognito group, admin screen) is not defined in this story; tests seed the column directly. Please confirm this is acceptable, or point me at the story that owns role assignment.
  - |
    Employee vs user: I treat the employee record as its own table, separate from sign-in users (the epic says it is the record Leave refers to). No link between the two is created here.
  - |
    Search semantics: substring match, case-insensitive, on name OR work email, whitespace trimmed; empty search = no filter. Tab counts follow the search but not the selected tab (as in the prototype).
  - |
    No pagination or sorting: the prototype shows none and the ACs do not ask for it. The API returns every matching employee ordered by name. If the real company size makes that a problem, pagination is a follow-up story.
  - |
    Prototype vs ACs: the prototype's no-match screen includes a "Clear search and show All" button and a hint line that the ACs do not mention; I build them since they sit inside the approved design and do not conflict with AC12/13. The prototype's "Viewing as" role switch and sample-search chips are prototype-only and are not built.
  - |
    Prototype vs AC9: the prototype labels the empty-state action "Add employee", while AC9 says an 'Add first employee' action. I follow the AC wording for the empty-state button label ("Add first employee") and keep "Add employee" for the toolbar button; the test for AC9 matches `{ name: /add (first )?employee/i }`. Please confirm which label you want.
  - |
    The Add button and row names have no destination yet (Add employee and profile are separate stories). The button is rendered for HR admins and calls an optional prop; rows are plain text, not links.
  - |
    Navigation: no router exists; the shell nav links other than Records are inert placeholders. The directory is the signed-in landing view under Records.
  - |
    Styling: the web app currently has only the Tailwind directives and no token wiring. I will map `design-system/tokens.css` into Tailwind (theme extension or CSS import) when implementing; I have not yet read design-system/ in detail to choose between the two.
estimated_points: 5
package_dependencies: []
notes: |
  Research findings: the web app is React 18 + Vite + Tailwind 3 with vitest and Playwright already configured (apps/web/package.json); the API is NestJS with TypeORM on Postgres, `autoLoadEntities` and `synchronize` outside production (services/api/src/app/app.module.ts), so a new entity needs no migration file in this repo's current setup. `SessionGuard` is exported from AuthModule, so EmployeesModule must import AuthModule to use it with `@UseGuards`. E2E tests in `services/api/test` boot the real AppModule against Postgres with a fake Cognito and seed users through `ds.getRepository(User).save(...)`; the employees e2e follows that pattern.

  No new packages are needed: ILIKE is plain TypeORM query-builder, and the icons are inline SVG (the prototype uses inline `<symbol>` icons).

  ```mermaid
  flowchart TD
    App[App.tsx shell] --> Dir[EmployeeDirectoryPage]
    App --> AuthP[AuthProvider]
    AuthP --> AuthC[authClient.getSession]
    Dir --> EC[employeesClient.listEmployees]
    Dir --> Tabs[StatusTabs]
    Dir --> Res[EmployeeResults]
    Res --> Badge[StatusBadge]
    EC -->|GET /employees| EmpCtl[EmployeesController]
    AuthC -->|GET /auth/session| AuthCtl[AuthController]
    EmpCtl --> Guard[SessionGuard]
    EmpCtl --> EmpSvc[EmployeesService]
    EmpSvc --> EmpEnt[Employee entity]
    Guard --> UserEnt[User entity]
    AuthCtl --> Guard
    AppMod[AppModule] --> EmpMod[EmployeesModule]
    EmpMod --> AuthMod[AuthModule]
    classDef touched fill:#f96,color:#000
    class App,Dir,AuthP,AuthC,EC,Tabs,Res,Badge,EmpCtl,EmpSvc,EmpEnt,Guard,UserEnt,AuthCtl,AppMod,EmpMod touched
  ```
  Touched nodes: App.tsx (shell + directory), AuthProvider/authClient (carry role), SessionGuard/User/AuthController (role in session), AppModule (register module). New: everything under `employees/` on both sides. AuthModule is untouched context.

  TDD order: (1) role in session (API e2e red, then entity/guard/controller; web provider test), (2) API list/search/status service spec then controller e2e, (3) web page tests for AC1-2, 8, then search AC3-7, then empty states AC9-13, (4) shell wiring and Playwright smoke last.

  Accessibility from the prototype and UI guidelines: 44px minimum targets on toolbar button, search, tabs and chips, visible focus ring (2px primary, 2px offset), `prefers-reduced-motion` disables the skeleton animation, badges always carry icon plus label so status is not colour-only, light theme only.
review_focus: |
  IN: the read-only directory (API list/search/status filter plus web page and shell) and the minimal `role` on the user needed to show or hide the Add action. OUT: adding employees, profile, editing, pagination, role assignment and any router. Riskiest areas are the `ILIKE` search (wildcard escaping, name OR email combined with the status filter) and deciding "no employees yet" from the unfiltered `total` so a search can never show the first-run screen. Deliberate choices: tab counts follow the search but not the selected tab, and the AC9 label "Add first employee" differs from the prototype's "Add employee" (flagged as an open question).
