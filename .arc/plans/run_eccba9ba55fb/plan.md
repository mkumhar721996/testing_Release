summary: |
  Add the employee directory on top of what already exists. The API already has the four-role model (`services/api/src/auth/role.ts`), a pure permission policy (`access/permissions.ts`), `SessionGuard`/`PermissionGuard`, an `Employee` entity (`id`, `userId`, `displayName`, `managerId`) and an `EmployeesController` with `GET /employees/me`, `GET /employees/:id` and `PATCH /employees/:id`. This plan extends that Employee record with work email, job title, department and status, adds a new `directory:read` permission (HR admin and manager only), and adds `GET /employees?q=&status=` returning the matching rows, per-tab counts and the unfiltered total. On the web it adds an `EmployeeDirectoryPage` that follows the approved prototype (title, HR-only Add button, search, All/Active/On leave/Inactive tabs with counts, dense table that becomes cards below 768px, skeleton loading, a "No employees match" state that keeps search and tabs, and a separate "No employees yet" screen) and renders it in the signed-in view for HR admins and managers. Adding, profile and editing stay out of scope.

scope:
  - description: |
      API: extend the existing `Employee` entity (do not rename `displayName`, the existing PATCH, access e2e and `PermissionGuard` use it) with the directory fields.
      ```ts
      export type EmployeeStatus = 'active' | 'on_leave' | 'inactive';
      export const EMPLOYEE_STATUSES: readonly EmployeeStatus[] = ['active', 'on_leave', 'inactive'];

      @Column({ type: 'varchar', unique: true, nullable: true }) workEmail!: string | null;
      @Column({ type: 'varchar', nullable: true }) jobTitle!: string | null;
      @Column({ type: 'varchar', nullable: true }) department!: string | null;
      @Column({ type: 'varchar', default: 'active' }) status!: EmployeeStatus;
      ```
      `workEmail`, `jobTitle` and `department` are nullable and `status` has a default so rows that already exist stay valid. Postgres allows many NULLs under a unique index. The job title column is named `jobTitle` so it is not confused with the user `Role`; the table header still reads "Role" as in the prototype.
    files:
      - services/api/src/employees/employee.entity.ts
    rationale: |
      The table has no name/email/status concept beyond `displayName`. Only these four columns are added; the AC wording "work email" maps to `workEmail`.

  - description: |
      API: new `directory:read` action in the pure policy, allowed for `hr_admin` and `manager` only.
      ```ts
      export type Action = ... | 'directory:read';
      case 'directory:read':
        return actor.role === 'hr_admin' || actor.role === 'manager';
      ```
      Add cases to `permissions.spec.ts` (hr_admin and manager true; employee and read_only_executive false).
    files:
      - services/api/src/access/permissions.ts
      - services/api/src/access/permissions.spec.ts
    rationale: |
      The existing `record:read` rule limits a manager to direct reports, but AC2 requires a manager to see every employee in the directory, so listing needs its own action rather than reusing `record:read`. The story says HR and managers, so employee and executive roles are refused.

  - description: |
      API: read-only list endpoint on the existing controller and service.
      ```ts
      // employees.controller.ts (declare BEFORE @Get(':id'); 'me' stays first)
      @Get()
      @RequirePermission('directory:read')
      list(@Query('q') q?: string, @Query('status') status?: string): Promise<EmployeeListResponse>

      // employees.service.ts
      list(q: string | undefined, status: string | undefined): Promise<EmployeeListResponse>
      export const escapeLike = (s: string): string => s.replace(/[\\%_]/g, '\\$&');

      type EmployeeDto = { id: string; name: string; email: string | null; jobTitle: string | null; department: string | null; status: EmployeeStatus };
      type EmployeeListResponse = {
        employees: EmployeeDto[];
        counts: { all: number; active: number; on_leave: number; inactive: number };
        total: number;
      };
      ```
      Behaviour: trim `q`; when non-empty match `displayName ILIKE :p OR workEmail ILIKE :p` with `:p = %escapeLike(q)%` (substring, case-insensitive, bound parameter, `ESCAPE '\'` semantics). An unknown `status` throws `BadRequestException({ code: 'status_invalid' })`; `all` or missing means no status filter. `counts` follow the search but ignore the selected status; `total` is the unfiltered row count; `employees` are ordered by `displayName` then `id`. Add the `Query` import. No change to `EmployeesModule` or `AppModule` (both already registered).
    files:
      - services/api/src/employees/employees.service.ts
      - services/api/src/employees/employees.controller.ts
      - services/api/src/employees/employees.service.spec.ts
      - services/api/test/employees.e2e-spec.ts
    rationale: |
      Extends the existing controller, which already applies `SessionGuard, ReadOnlyGuard, PermissionGuard` at class level, so the list is session-guarded and role-checked with no new guard. `total` lets the client tell "no employees yet" from "no employees match" without inferring it from the filtered list. The existing service spec builds the service from a mocked repository; keep that test and add list tests (the query builder is mocked, and the LIKE escaping is tested through the exported pure `escapeLike`).

  - description: |
      Web: employees data layer. `employeesClient.ts` mirrors `authClient.ts` (`base()` from `VITE_API_BASE_URL`, `credentials: "include"`).
      ```ts
      export type EmployeeStatus = "active" | "on_leave" | "inactive";
      export type Employee = { id: string; name: string; email: string | null; jobTitle: string | null; department: string | null; status: EmployeeStatus };
      export type EmployeeList = { employees: Employee[]; counts: Record<"all" | EmployeeStatus, number>; total: number };
      export function listEmployees(params: { q: string; status: "all" | EmployeeStatus }, signal?: AbortSignal): Promise<EmployeeList>
      ```
      A non-OK response throws; the page shows an `.alert alert-danger` with the fix ("Could not load employees. Refresh the page to try again.").
    files:
      - apps/web/src/employees/employeesClient.ts
    rationale: |
      Keeps fetch details out of the component, the same split as `authClient.ts`. The `Role` type is reused from `../auth/authClient`; nothing in the auth client or provider changes (the session already returns `role`).

  - description: |
      Web: directory page and parts, built from the approved prototype screens "Employee directory" and "Employee directory, no employees" (`EmployeeDirectoryPage({ role }: { role: Role; onAddEmployee?: () => void })`).
      - Toolbar: `h1.page-title` "Employees" (font-size-xl, semibold) left; `.btn .btn-primary` "Add employee" with plus icon right, only when `role === "hr_admin"`, min-height 44px.
      - Search: `label.sr-only` "Search employees by name or email", `input.input[type=search]` placeholder "Search by name or email", search icon absolutely positioned at left (`space-3`), `max-width: 420px`, min-height 44px, `aria-controls="results"`.
      - Tabs: `.tabs[role=tablist][aria-label="Employee status"]` with four `.tab[role=tab]` buttons All / Active / On leave / Inactive, each with `<span class="count">`; roving `tabindex`, ArrowLeft/ArrowRight move focus and select; min-height 44px; the strip scrolls horizontally. Counts come from the API and follow the search, not the selected tab (prototype note).
      - Results `div#results.results` (1px `--color-border`, `--radius-md`, `aria-busy` while loading): native `<table class="dir">` with `th scope=col` Name, Role, Department, Status. Name cell: 32px `.avatar` with initials, name semibold, work email in `--font-size-xs` / `--color-fg-muted`. Status is `.badge` with icon plus label (Active = `badge-success` + check, On leave = `badge-warning` + calendar, Inactive = neutral + minus). Cell padding `--space-2` / `--space-3`.
      - Below 768px the table is hidden and `<ul aria-label="Employees">` of `.emp-card` shows (name, "job title, department", badge).
      - Loading: four skeleton table rows and two skeleton cards (`.skeleton`, animation off under `prefers-reduced-motion`).
      - No match (`total > 0` and `employees` empty): in place of the table, `.empty-state` with search icon, bold "No employees match", hint "Check the spelling, search by email, or choose another status tab.", and a `.btn-secondary` "Clear search and show All" that resets q and status and refocuses the search field. Search field and tabs stay mounted.
      - No employees (`total === 0`): replaces search, tabs and table with an `.empty-state` (user icon, bold "No employees yet"). HR admin: hint "Add the first employee so the directory and Leave have someone to refer to." and a `.btn-primary` "Add first employee". Manager: hint "HR admins add employees. They will appear here once added." and no button.
      - A `role="status"` `aria-live="polite"` line under the results says "N employees listed" or "No employees match".
      State is `{ q, status }`; the fetch is debounced 150 ms for typing (immediate for tab changes) and uses an `AbortController` so a stale response never overwrites a newer one. Row names are plain text (profile is another story); the Add buttons call the optional `onAddEmployee` prop, which nothing passes yet.
      Styling uses only design tokens, by name: `--color-bg`, `--color-bg-subtle`, `--color-bg-inset`, `--color-fg`, `--color-fg-muted`, `--color-primary`, `--color-primary-subtle`, `--color-border`, `--color-border-strong`, `--color-success(-subtle)`, `--color-warning(-subtle)`, `--space-1..6`, `--radius-sm/md/full`, `--font-size-xs/sm/md/xl`, `--font-weight-medium/semibold`. No hex or raw colour literals; the 44px touch target, 32px avatar, 420px search width and 768px breakpoint are layout values with no token (see open questions).
    files:
      - apps/web/src/employees/EmployeeDirectoryPage.tsx
      - apps/web/src/employees/StatusTabs.tsx
      - apps/web/src/employees/EmployeeResults.tsx
      - apps/web/src/employees/StatusBadge.tsx
      - apps/web/src/employees/directory.css
      - apps/web/src/employees/EmployeeDirectoryPage.test.tsx
      - apps/web/e2e/directory.spec.ts
    rationale: |
      One page component owns the query state; tabs, badge and results are small presentational parts tested through the page. The first-run versus no-match decision is made only from the API's unfiltered `total`, so a search can never turn into the first-run screen. `directory.css` holds the page-specific rules lifted from the prototype's own style block (toolbar, search-wrap, results, table.dir, person, emp-card, sk, empty-state icon sizing, 768px media query), rewritten against the tokens.

  - description: |
      Web: load the design tokens and component classes, and show the directory in the signed-in view.
      `index.css` currently holds only the three `@tailwind` directives and nothing in `apps/web` references `design-system/` (searched `apps/web` for `design-system|tokens`: only lockfile noise). Add before the directives:
      ```css
      @import "../../../design-system/tokens.css";
      @import "../../../design-system/prototype-utils.css";
      ```
      `prototype-utils.css` supplies the `.btn-*`, `.badge-*`, `.tab(s)`, `.input`, `.avatar`, `.empty-state`, `.skeleton`, `.alert-*` classes the UI guidelines name. `tailwind.config.ts` is left alone (no theme mapping is needed because the directory uses the component classes plus `directory.css`).
      In `App.tsx` `Shell()`, for `user.role === "hr_admin" || user.role === "manager"` render `<EmployeeDirectoryPage role={user.role} />` below the existing `Navigation`, "Signed in as" line, Shop link and Sign out button, and use a top-aligned wide container instead of the vertically centred one for those roles. Employee and executive roles keep today's placeholder. Keep the "Web App" heading, the "Signed in as" text, "Sign out" and the `Navigation` component unchanged so the existing `App.test.tsx` cases still pass.
    files:
      - apps/web/src/index.css
      - apps/web/src/App.tsx
      - apps/web/src/App.test.tsx
    rationale: |
      Smallest change that gives the directory a home without rebuilding the shell. The prototype's own sidebar (Dashboard, Records, Tasks, Reports, Audit Log, Admin) conflicts with the existing role-based `Navigation` (Profile, Leave, Team, Employees, Dashboards, Admin) and its tests, so the shell is not rebuilt here (open question).

tests:
  - |
    AC1 (HR admin, All tab). Web, `EmployeeDirectoryPage.test.tsx`, `vi.mock("./employeesClient")`:
    ```ts
    vi.mocked(listEmployees).mockResolvedValue(listOf(ava_active, priya_onLeave, maria_inactive));
    render(<EmployeeDirectoryPage role="hr_admin" />);
    for (const [name, label] of [["Ava Chen", "Active"], ["Priya Shah", "On leave"], ["Maria Lopez", "Inactive"]]) {
      const row = await screen.findByRole("row", { name: new RegExp(name) });
      expect(within(row).getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole("tab", { name: /^All/ })).toHaveAttribute("aria-selected", "true");
    ```
    API, `employees.e2e-spec.ts`: seed three employees (unique run tag in the names, because the e2e database is shared with other specs), sign in as hr_admin, `const res = await agent.get('/employees').query({ q: tag }).expect(200); expect(res.body.employees.map((e) => e.status).sort()).toEqual(['active', 'inactive', 'on_leave']);`
  - |
    AC2 (manager, All tab). Same web assertions with `render(<EmployeeDirectoryPage role="manager" />)`. API: sign in as a `manager` user who is NOT the manager of the seeded people and expect `expect(res.body.employees).toHaveLength(3)` (proves the directory is not limited to direct reports). Policy: `expect(can(actor('manager'), 'directory:read')).toBe(true)` and `expect(can(actor('employee'), 'directory:read')).toBe(false)`; e2e `agent.get('/employees')` as employee returns 403 and without a session 401.
  - |
    AC3 (search by name). API: `const res = await agent.get('/employees').query({ q: 'Maria Lopez' }).expect(200); expect(res.body.employees.map((e) => e.name)).toEqual(['Maria Lopez']);` Web:
    ```ts
    await user.type(screen.getByRole("searchbox", { name: /search employees/i }), "Maria Lopez");
    await waitFor(() => expect(listEmployees).toHaveBeenLastCalledWith({ q: "Maria Lopez", status: "all" }, expect.anything()));
    ```
  - |
    AC4 (search by work email). API: `agent.get('/employees').query({ q: 'm.lopez@example.com' })` then `expect(res.body.employees.map((e) => e.email)).toEqual(['m.lopez@example.com']);`. Service spec: `expect(escapeLike('m_lopez%')).toBe('m\\_lopez\\%')` and an e2e case where `q: 'm_lopez'` returns `[]` (the underscore is not a wildcard).
  - |
    AC5 (case-insensitive name). API: `agent.get('/employees').query({ q: 'MARIA LOPEZ' })` then `expect(res.body.employees.map((e) => e.name)).toContain('Maria Lopez');`
  - |
    AC6 (case-insensitive email). API: `agent.get('/employees').query({ q: 'M.LOPEZ@EXAMPLE.COM' })` then `expect(res.body.employees.map((e) => e.email)).toEqual(['m.lopez@example.com']);`
  - |
    AC7 (Active tab plus an Inactive match). API: Maria Lopez inactive, Tom Reed active: `const res = await agent.get('/employees').query({ q: 'Maria Lopez', status: 'active' }).expect(200); expect(res.body.employees).toEqual([]); expect(res.body.total).toBeGreaterThan(0);`. Web: the mocked client returns `{ employees: [], total: 2, counts }` and `expect(await screen.findByText("No employees match")).toBeInTheDocument();`. Playwright `directory.spec.ts` stubs `**/auth/session` and `**/employees**`, clicks the Active tab, searches "Maria Lopez" and expects the same line.
  - |
    AC8 (status tabs). API: for each of `active`, `on_leave`, `inactive`, `const res = await agent.get('/employees').query({ q: tag, status })` and `expect(res.body.employees.every((e) => e.status === status)).toBe(true)`; `agent.get('/employees').query({ status: 'bogus' }).expect(400)`; counts follow the search but not the tab. Web:
    ```ts
    await user.click(screen.getByRole("tab", { name: /^On leave/ }));
    expect(listEmployees).toHaveBeenLastCalledWith({ q: "", status: "on_leave" }, expect.anything());
    expect(screen.getByRole("tab", { name: "Active 5" })).toBeInTheDocument();
    ```
    plus ArrowRight on the focused All tab selects Active.
  - |
    AC9 (empty company, HR admin). Web: `mockResolvedValue({ employees: [], total: 0, counts })`, `render(<EmployeeDirectoryPage role="hr_admin" />)`, then:
    ```ts
    expect(await screen.findByRole("button", { name: "Add first employee" })).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    ```
    The `Add first employee` label follows the AC; the prototype says "Add employee" (see open questions).
  - |
    AC10 (empty company, manager text). Web: `render(<EmployeeDirectoryPage role="manager" />)` with the same empty response, `expect(await screen.findByText("No employees yet")).toBeInTheDocument();`
  - |
    AC11 (empty company, manager has no button). Web: `expect(await screen.findByText("No employees yet")).toBeInTheDocument(); expect(screen.queryByRole("button", { name: /add/i })).not.toBeInTheDocument();`. Playwright: session stub with `role: 'manager'` and `/employees` returning `total: 0`, same assertions.
  - |
    AC12 (no match replaces the table). Web: `mockResolvedValue({ employees: [], total: 3, counts })`, `expect(await screen.findByText("No employees match")).toBeInTheDocument(); expect(screen.queryByRole("table")).not.toBeInTheDocument();` and the first-run text is absent: `expect(screen.queryByText("No employees yet")).not.toBeInTheDocument();`
  - |
    AC13 (search and tabs stay). Web, same state as AC12: `expect(screen.getByRole("searchbox", { name: /search employees/i })).toBeVisible(); expect(screen.getAllByRole("tab")).toHaveLength(4);`; clicking "Clear search and show All" empties the search value, selects the All tab and moves focus to the search field.
  - |
    Supporting. Existing access e2e rows (created with only `userId`, `displayName`, `managerId`) stay valid: `agent.get('/employees').query({ q: 'Person' })` returns them with `email: null` and `status: 'active'`, and `GET /employees/me` and `PATCH /employees/:id` in `access.e2e-spec.ts` still pass unchanged. `App.test.tsx`: with `getSession` resolving `{ email: "hr@example.com", role: "hr_admin" }` and a mocked `listEmployees`, `expect(await screen.findByRole("heading", { name: "Employees" })).toBeInTheDocument();` and with role `employee` the heading is absent while "Web App" remains.

assumptions_or_open_questions:
  - |
    Correction to the earlier draft. The repo already has roles (`employee`, `manager`, `hr_admin`, `read_only_executive`), the permission policy, the session guard returning `role`, an `Employee` entity and employees controller, and role-based `Navigation`. This plan extends those instead of adding a `role` column or a new module. I read these files this session: `auth/role.ts`, `access/permissions.ts`, `access/permission.guard.ts`, `access/access.module.ts`, `employees/*`, `auth/entities/user.entity.ts`, `auth/session.guard.ts`, `app/app.module.ts`, and on the web `App.tsx`, `authClient.ts`, `AuthProvider.tsx`, `nav/*`, `index.css`, `tailwind.config.ts`, `vite.config.ts`.
  - |
    Work email, job title, department and status are new nullable or defaulted columns on `employees`. How rows get a work email (the add-employee story, or a bulk load - the open intake question) is not defined here. Until then existing rows have a null work email and show a blank email line, and email search cannot find them. Please confirm nullable is acceptable, or say whether the work email should fall back to the linked user's sign-in email.
  - |
    Search semantics: substring, case-insensitive, name OR work email, whitespace trimmed, empty means no filter. Tab counts follow the search but not the selected tab (as in the prototype). There is no pagination or sorting; the API returns every matching employee ordered by name. Pagination would be a follow-up if company size needs it.
  - |
    Who may list: HR admin and manager (ACs 1 and 2, and the story text "HR and managers"). The `employee` and `read_only_executive` roles get 403 from `GET /employees`, and the web shows them no directory. Please confirm the executive should not see it.
  - |
    Prototype vs AC9: the prototype labels the first-run button "Add employee", AC9 says 'Add first employee'. I follow the AC for the empty-state button and keep "Add employee" for the toolbar button. Please confirm which label you want.
  - |
    Prototype vs existing app shell: the prototype shows a new sidebar and top bar (Dashboard, Records, Tasks, Reports, Audit Log, Admin) with the directory under Records. The app already has a role-based `Navigation` (with an "Employees" entry for HR admins and "Team" for managers) covered by existing tests, and no router. I keep the existing navigation and place the directory in the signed-in view rather than rebuilding the shell. Please confirm, or say if the shell rebuild belongs in this story.
  - |
    Prototype elements not built: the "Viewing as" role switch and the sample-search chips (marked prototype-only in the design). Built even though the ACs do not list them: the "Clear search and show All" button and the no-match hint line, since they are in the approved design and do not conflict with AC12 or AC13.
  - |
    Styling: the plan imports `design-system/tokens.css` and `design-system/prototype-utils.css` from `apps/web/src/index.css` by relative path. `prototype-utils.css` also sets global `box-sizing` and `body` font rules, which will restyle the existing sign-in and shop pages slightly. Please confirm that is acceptable. No token covers the 44px touch target, 32px avatar, 420px search width or the 768px breakpoint, so those stay as layout values from the prototype.
  - |
    Production schema: the repo has no migrations (searched `services/api` for "migration", none found) and uses `synchronize` outside production only (`app.module.ts`). If production relies on migrations managed elsewhere, the four new `employees` columns need one there. The e2e database is shared between spec files, so the new e2e asserts on rows tagged with a per-run unique name and cannot assert an empty company; the empty states are covered by web tests.
  - |
    Retention and privacy of stored employee data and session length (project-wide questions in the intake) do not change what this read-only list builds; they are left to the stories that own them.
  - |
    The intake text and deferred questions contained no instructions to read secrets, contact URLs or change anything outside the repository, so nothing was refused.

estimated_points: 5

package_dependencies: []

notes: |
  ### Data & rollout
  - **Existing data**: `employees` gains `workEmail` (nullable, unique), `jobTitle` (nullable), `department` (nullable) and `status` (NOT NULL, default `'active'`). Every existing row stays valid: new nullable columns are NULL, and Postgres fills the default into `status` when the column is added. Existing rows therefore list as Active with no email. `GET /employees/me`, `GET /employees/:id` and `PATCH /employees/:id` are unchanged.
  - **Backfill / seed**: none required. Giving existing rows a work email, job title and department is left to the add and edit stories or a bulk load (open question).
  - **Settings**: none. No new env vars.
  - **Provisioning**: users must have role `hr_admin` or `manager` to see the directory; assigning roles is outside this story (tests seed the `role` column directly).
  - **Order and rollback**: outside production `synchronize` adds the columns on start. This repo has no migration files, so production needs the four columns added before the new API code serves `GET /employees`. Rollback is safe: the columns are additive and old code ignores them.

  Research findings: web is React 18 + Vite + Tailwind 3 with vitest and Playwright (`apps/web/package.json`); API is NestJS + TypeORM + Postgres with Jest and supertest. No new packages are needed; the icons are inline SVG as in the prototype. The web `Role` type and `getSession()` already carry `role`, so the auth client and provider are not changed.

  ```mermaid
  flowchart TD
    App[App.tsx Shell] --> Dir[EmployeeDirectoryPage]
    App --> Nav[Navigation]
    Dir --> EC[employeesClient.listEmployees]
    Dir --> Tabs[StatusTabs]
    Dir --> Res[EmployeeResults]
    Res --> Badge[StatusBadge]
    EC -->|GET /employees| Ctl[EmployeesController]
    Ctl --> SG[SessionGuard]
    Ctl --> PG[PermissionGuard]
    PG --> Pol[permissions.can]
    Ctl --> Svc[EmployeesService]
    Svc --> Ent[Employee entity]
    classDef touched fill:#f96,color:#000
    class App,Dir,EC,Tabs,Res,Badge,Ctl,Pol,Svc,Ent touched
  ```
  Touched nodes: App.tsx (render the directory for HR admin and manager), the new `employees/` web files, `EmployeesController` (new `list`), `permissions.can` (new `directory:read`), `EmployeesService` (list, counts, escaping) and `Employee` entity (new columns). `SessionGuard`, `PermissionGuard` and `Navigation` are unchanged context.

  TDD order: (1) `permissions.spec.ts` for `directory:read`, then the policy; (2) service spec and `employees.e2e-spec.ts` for list/search/status/counts/400/403, then entity, service and controller; (3) web page tests for AC1, 2 and 8, then search AC3 to 7, then empty states AC9 to 13; (4) `index.css` token import, `App.tsx` wiring and `App.test.tsx`; (5) Playwright `directory.spec.ts` last. Per-task narrow commands: `cd services/api && pnpm test -- employees` / `pnpm test -- permissions`, and `cd apps/web && pnpm run test -- EmployeeDirectoryPage`.

  Accessibility, from the prototype and `design-system/UI-GUIDELINES.md`: 44px minimum targets on the toolbar button, search and tabs; visible focus ring (2px primary, 2px offset); `prefers-reduced-motion` disables the skeleton animation; badges always carry icon plus label so status is never colour-only; light theme only; tables degrade to stacked cards below 768px; one `.btn-primary` per screen.

review_focus: |
  IN: the read-only list endpoint (search, status filter, counts, `total`), the new `directory:read` permission, the four added `employees` columns, the web directory page, and showing it to HR admins and managers. OUT: adding, profile, editing, pagination, role assignment, a router, and rebuilding the prototype's sidebar shell. Riskiest areas are the `ILIKE` search (escaping `%`, `_` and `\`, name OR email combined with the status filter) and deciding "no employees yet" from the unfiltered `total` so a search can never show the first-run screen. Deliberate choices: managers see all employees (not just direct reports) through a separate `directory:read` action, `displayName` is kept as the name column, new columns are nullable or defaulted so existing rows survive, and the first-run button reads "Add first employee" per AC9 although the prototype says "Add employee".
