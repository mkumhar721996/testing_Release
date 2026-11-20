summary: |
  Give the read-only executive a company-wide dashboard showing two aggregate figures: total headcount (count of Employee rows) and total leave days taken in the current leave year (summed from LeaveEntry rows). The API gets a new executive-only endpoint `GET /dashboards/executive` that returns only counts (no names, no pay, no ids), guarded by a new `dashboards:executive` permission so managers, HR admins and employees are refused (AC7). The Web App gets an `ExecutiveDashboardPage` at `/dashboards/executive`, built to the approved prototype (page head with Read-only badge, two plain-text stat cards, scope-note card, plus loading, empty, error and not-available states). Nothing on the page is a link, button (other than "Try again" on the error state) or form, so no record can open and nothing can change data (AC4, AC6).
scope:
  - description: |
      Add a `dashboards:executive` action to the pure policy and allow it only for `read_only_executive`. Existing `dashboards:read` (non-employee roles) is left unchanged.
      ```ts
      export type Action = ... | 'dashboards:executive';
      case 'dashboards:executive':
        return actor.role === 'read_only_executive';
      ```
    files:
      - services/api/src/access/permissions.ts
      - services/api/src/access/permissions.spec.ts
    rationale: |
      `dashboards:read` also admits managers and HR admins, so it cannot satisfy AC7. A dedicated action keeps the rule in the existing policy and enforced by `PermissionGuard`.
  - description: |
      Create `DashboardsService.executiveSummary(today: Date)` that runs two aggregate queries and returns counts only:
      ```ts
      export interface ExecutiveSummary {
        headcount: number;
        leaveDaysTaken: number;
        leaveYear: { from: string; to: string }; // ISO dates, 1 Jan of this year .. today
        hasData: boolean; // headcount > 0 || leaveDaysTaken > 0 || any leave entry in range
      }
      ```
      Headcount is `employeeRepo.count()`. Leave days is one SQL aggregate over `leave_entries`, clipping each entry to [yearStart, today] and counting calendar days inclusive: `SUM(LEAST("endDate", :today) - GREATEST("startDate", :yearStart) + 1)` where `"startDate" <= :today AND "endDate" >= :yearStart`, coalesced to 0 and cast to number. No select of names, pay or ids. Add `DashboardsController.executive()` as `@Get('executive') @RequirePermission('dashboards:executive')` returning the summary. The class keeps `SessionGuard, ReadOnlyGuard, PermissionGuard`. Register the service and `TypeOrmModule.forFeature([Employee, LeaveEntry])` in `DashboardsModule`. Take "today" from the existing injectable clock in `services/api/src/auth/clock.ts` if it exposes the current time, otherwise add a small injectable so tests can pin the date.
    files:
      - services/api/src/dashboards/dashboards.service.ts
      - services/api/src/dashboards/dashboards.service.spec.ts
      - services/api/src/dashboards/dashboards.controller.ts
      - services/api/src/dashboards/dashboards.module.ts
      - services/api/test/dashboards.e2e-spec.ts
    rationale: |
      Data behind the screen lives in the API (ADR-0016, ADR-0017); the Web App never computes totals from employee lists. Aggregating in SQL means no employee row or name ever leaves the database for this endpoint and it scales to the thousands-of-users target (ADR-0025). Read-only is double enforced: GET only plus `ReadOnlyGuard`.
  - description: |
      Add the Web client `getExecutiveSummary()` and the page. Client:
      ```ts
      export type ExecutiveSummary = { headcount: number; leaveDaysTaken: number; leaveYear: { from: string; to: string }; hasData: boolean };
      export type SummaryResult = { kind: "ok"; summary: ExecutiveSummary } | { kind: "forbidden" };
      export async function getExecutiveSummary(): Promise<SummaryResult>; // 403 -> forbidden, other non-ok -> throws
      ```
      `ExecutiveDashboardPage({ role }: { role: Role })` renders inside `RecordsLayout`. State union: loading, ok, empty (`hasData` false), forbidden, error. If `role !== "read_only_executive"` it renders the not-available state without calling the API; a 403 from the API renders the same state. States and copy from the prototype:
      - default: `.page-head` with `h1` "Executive dashboard", muted line "Company-wide headcount and leave. Read-only." and `.badge` "Read-only"; `.grid-2` of two `.card`s each holding `.stat` (label "Total headcount" / "Total leave taken", `strong` value formatted with `toLocaleString("en-US")`, leave suffixed " days", notes "Employees across all departments" / "All leave types, current leave year"); a `.card` with `p.scope-note` "Figures are company-wide aggregates. Individual employee records are not shown here."
      - loading: `aria-busy="true"` `.grid-2` of two `.card`s each with a `.skeleton` of height `var(--space-6)`, and `p[role=status].viewing` "Loading company headcount and leave…"
      - empty: same page head, `.empty-state` "No headcount or leave data is available for the company yet." and NO stat cards and no totals
      - forbidden: `.empty-state` "The executive dashboard is not available to your role." with no page head or figures
      - error: `.alert.alert-danger[role=alert]` "Company headcount and leave could not be loaded. Check your connection and try again." and a `.btn.btn-secondary` "Try again" that re-fetches
      Stat cards are plain `div`/`span`/`strong`, never `a` or `button` (AC4). `.btn-primary` is not used anywhere (no primary action on this screen, per UI guidelines).
    files:
      - apps/web/src/dashboards/dashboardsClient.ts
      - apps/web/src/dashboards/ExecutiveDashboardPage.tsx
      - apps/web/src/dashboards/ExecutiveDashboardPage.test.tsx
      - apps/web/src/dashboards/dashboardsClient.test.ts
    rationale: |
      Follows the existing `employeesClient.ts` / `EmployeesPage.tsx` pattern (fetch with `credentials: "include"`, state union, skeleton, alert with "Try again"). The client-side role check is a convenience only; the API enforces access (same stance as `navigation.ts`).
  - description: |
      Styling and shell. Add `dashboard.css` defining the prototype's page-local classes on tokens only: `.stat` (flex column, gap `var(--space-1)`), `.stat strong` (`var(--font-size-xl)`, `var(--font-weight-semibold)`, `font-variant-numeric: tabular-nums`), `.stat-label` (`var(--font-size-sm)`, `var(--font-weight-medium)`), `.stat-note` and `.scope-note` and `.viewing` (`var(--font-size-xs)`/`sm`, `var(--color-fg-muted)`), `.state-block` (flex column, gap `var(--space-3)`), and a `.dashboard-page` wrapper (flex column, gap `var(--space-5)`) for the prototype's `.page`. Import it in `main.tsx` next to `records.css`. Reused as-is and already loaded: `.card`, `.grid-2`, `.badge`, `.alert`, `.alert-danger`, `.empty-state`, `.skeleton`, `.btn`, `.btn-secondary` from `design-system/prototype-utils.css`, and `.page-head`, `.muted` from `records.css`. Make `RecordsLayout` take an optional `current` prop (default `"records"`) so its `aria-current="page"` moves to Dashboard on this page, and give the Dashboard entry an `href` of `/dashboards/executive` only when the viewer is the executive.
    files:
      - apps/web/src/dashboards/dashboard.css
      - apps/web/src/main.tsx
      - apps/web/src/employees/RecordsLayout.tsx
    rationale: |
      Tokens are already loaded in `apps/web/src/index.css` lines 1-2 (`@import "../../../design-system/tokens.css"` and `prototype-utils.css`), so no new token wiring is needed. The prototype's `.stat`, `.scope-note`, `.viewing`, `.state-block` are defined only inline in the prototype, so they are redefined on the same tokens. No hex or pixel literals; `height: var(--space-6)` for skeletons as in the prototype. Layout is `.grid-2` on desktop; the existing `records.css` rule at max-width 640px collapses `.cards` only, so add a `max-width: 640px` rule to `dashboard.css` stacking this page's grid to one column (UI guidelines: below 768px content stacks).
  - description: |
      Routing and navigation entry. In `App.tsx` add `if (path === "/dashboards/executive") return <ExecutiveDashboardPage role={user.role} />;` beside the other path switches. In `Navigation.tsx` render the "Dashboards" label as a link to `/dashboards/executive` when the role is `read_only_executive` (same pattern as the Employees link).
    files:
      - apps/web/src/App.tsx
      - apps/web/src/nav/Navigation.tsx
      - apps/web/src/nav/Navigation.test.tsx
      - apps/web/e2e/executive-dashboard.spec.ts
    rationale: |
      The app routes on `window.location.pathname` with no router library; this matches it. Managers and HR admins keep a plain "Dashboards" label (their dashboards are other stories).
tests:
  - |
    AC7 policy (write first, `services/api/src/access/permissions.spec.ts`):
    ```ts
    it('allows dashboards:executive for the executive only (AC7)', () => {
      expect(can(actor('read_only_executive'), 'dashboards:executive')).toBe(true);
      for (const role of ['employee', 'manager', 'hr_admin'] as Role[]) {
        expect(can(actor(role), 'dashboards:executive')).toBe(false);
      }
    });
    ```
  - |
    AC1, AC2, AC8, AC9 service (`dashboards.service.spec.ts`, jest, with repositories stubbed or an in-memory test database matching the other API specs):
    ```ts
    expect(await service.executiveSummary(new Date('2026-11-20'))).toMatchObject({ headcount: 3, leaveDaysTaken: 7, hasData: true });
    // an entry 2026-12-30..2027-01-02 is excluded (future); 2025-12-30..2026-01-02 counts 2 days (clipped to the leave year)
    // no employees and no leave entries:
    expect(await service.executiveSummary(today)).toEqual({ headcount: 0, leaveDaysTaken: 0, leaveYear: { from: '2026-01-01', to: '2026-11-20' }, hasData: false });
    ```
  - |
    AC1, AC2, AC3, AC5, AC6, AC7 endpoint (`services/api/test/dashboards.e2e-spec.ts`, pattern of `access.e2e-spec.ts`):
    ```ts
    const res = await execAgent.get('/dashboards/executive').expect(200);
    expect(typeof res.body.headcount).toBe('number');
    expect(typeof res.body.leaveDaysTaken).toBe('number');
    expect(Object.keys(res.body).sort()).toEqual(['hasData', 'headcount', 'leaveDaysTaken', 'leaveYear']);
    expect(JSON.stringify(res.body)).not.toContain('Secret Name'); // seeded employee with a pay figure
    expect(JSON.stringify(res.body)).not.toMatch(/pay|displayName/i);
    await execAgent.post('/dashboards/executive').expect(403); // executive cannot change anything
    for (const agent of [employeeAgent, managerAgent, hrAdminAgent]) await agent.get('/dashboards/executive').expect(403);
    await request(app.getHttpServer()).get('/dashboards/executive').expect(401);
    ```
  - |
    AC1, AC2 page (`ExecutiveDashboardPage.test.tsx`, vitest and Testing Library, `vi.mock("./dashboardsClient")`):
    ```tsx
    vi.mocked(client.getExecutiveSummary).mockResolvedValue({ kind: "ok", summary: { headcount: 248, leaveDaysTaken: 1312, leaveYear: { from: "2026-01-01", to: "2026-11-20" }, hasData: true } });
    render(<ExecutiveDashboardPage role="read_only_executive" />);
    expect(await screen.findByText("248")).toBeInTheDocument();
    expect(screen.getByText("1,312 days")).toBeInTheDocument();
    ```
  - |
    AC3, AC5, AC6 page: with the default state rendered, assert no names, pay or controls.
    ```tsx
    expect(screen.queryByText(/£|salary|pay/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();   // no create/edit/approve/delete control
    expect(screen.queryByRole("link", { name: /employee/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(client.searchEmployees).not.toHaveBeenCalled(); // module not imported by the page
    ```
    Caveat on the button assertion: RecordsLayout's mobile menu button and disabled section buttons are shell, so scope the query with `within(screen.getByRole("main"))`.
  - |
    AC4 page: activating a figure opens nothing.
    ```tsx
    await userEvent.click(screen.getByText("248"));
    await userEvent.click(screen.getByText("1,312 days"));
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByText("248").closest("a,button")).toBeNull();
    ```
  - |
    AC7 page: not an executive.
    ```tsx
    render(<ExecutiveDashboardPage role="manager" />);
    expect(screen.getByText("The executive dashboard is not available to your role.")).toBeInTheDocument();
    expect(client.getExecutiveSummary).not.toHaveBeenCalled();
    expect(screen.queryByText("Total headcount")).not.toBeInTheDocument();
    // API 403 for an executive-looking client gives the same message
    vi.mocked(client.getExecutiveSummary).mockResolvedValue({ kind: "forbidden" });
    ```
  - |
    AC8, AC9 page: empty.
    ```tsx
    vi.mocked(client.getExecutiveSummary).mockResolvedValue({ kind: "ok", summary: { headcount: 0, leaveDaysTaken: 0, leaveYear: { from: "2026-01-01", to: "2026-11-20" }, hasData: false } });
    render(<ExecutiveDashboardPage role="read_only_executive" />);
    expect(await screen.findByText("No headcount or leave data is available for the company yet.")).toBeInTheDocument();
    expect(screen.queryByText("Total headcount")).not.toBeInTheDocument();
    expect(screen.queryByText("Total leave taken")).not.toBeInTheDocument();
    expect(screen.queryByText(/\b0\b/)).not.toBeInTheDocument();
    ```
  - |
    Loading and error states (design-listed, not in the ACs): pending promise gives `aria-busy` region and "Loading company headcount and leave…"; a rejected promise gives `role="alert"` with the error copy, and clicking "Try again" calls `getExecutiveSummary` a second time.
  - |
    Client (`dashboardsClient.test.ts`): `fetch` mocked; 200 gives `{ kind: "ok" }`; 403 gives `{ kind: "forbidden" }`; 500 rejects; request goes to `/dashboards/executive` with `credentials: "include"`.
  - |
    Navigation (`Navigation.test.tsx`): `render(<Navigation role="read_only_executive" />)` shows a link named Dashboards with `href="/dashboards/executive"`; the manager and HR admin render plain text with no link.
  - |
    E2E (`apps/web/e2e/executive-dashboard.spec.ts`, Playwright, `page.route` stubs like `access.spec.ts`): an executive session plus a stubbed `**/dashboards/executive` returning `{ headcount: 248, leaveDaysTaken: 1312, ... }` shows "248" and "1,312 days" at `/dashboards/executive` (AC1, AC2); a stubbed manager session shows the not-available message and no "Total headcount" (AC7). Narrow run: `cd apps/web && pnpm exec playwright test e2e/executive-dashboard.spec.ts`. Unit narrow forms: `cd apps/web && pnpm run test -- src/dashboards` and `cd services/api && pnpm test -- dashboards permissions`.
assumptions_or_open_questions:
  - |
    "Leave taken" and "current leave year" are not defined in the item. Assumed: calendar year (1 Jan to today, matching the prototype's "1 Jan – 20 Nov 2026" sample), all leave kinds, calendar days inclusive of both ends, only days on or before today (so approved future leave is not "taken"). `LeaveEntry` has no status or working-day calendar, so there is nothing to filter on for approval status or weekends. Needs a product decision if working days or a fiscal leave year is wanted.
  - |
    "No headcount or leave data" is treated as zero employees AND zero leave days. If headcount is above zero but no leave has been taken, both totals are shown (leave as "0 days") rather than the empty message; the prototype does not cover this case. Please confirm.
  - |
    Deferred open question (how large is the employee population, what load time is acceptable): not answerable from the code. ADR-0025 sizes the system for thousands of users, and the endpoint is two aggregate queries (a count and a clipped sum) that need no per-employee transfer, so no caching, index or job is planned. If a stricter load-time target exists, say so before code is written.
  - |
    The prototype's shell shows brand "Comp Console", a top bar with search, notifications and Account; the app's `RecordsLayout` has brand "Acme HR" and an empty top bar. The plan reuses `RecordsLayout` as-is rather than rebuilding the shell (shell redesign is outside this story). The prototype's "Leave by type" note card (`data-wf-id="leave-by-type-note"`) is only a scope note with no breakdown, and is built as such.
  - |
    The prototype's "Dashboard" sidebar item has no destination in the app; here it links to `/dashboards/executive` for the executive only. Other roles keep a disabled Dashboard entry because their dashboards belong to other stories. The prototype's "not-executive" state shows only the message (no page head), and the plan follows that.
  - |
    The prototype's error "Try again" uses `data-goto-state="default"` (prototype wiring only); in production it re-requests the summary. It is the only button on the page and re-reading is not a data change (AC6 holds).
  - |
    HR admins and managers are refused the executive dashboard (AC7 says any non-executive). The pre-existing `dashboards:read` rule and `GET /dashboards` stub are untouched.
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout
  None — read-only aggregate over the existing `employees` and `leave_entries` tables. No schema, migration, seed, setting or env var change; nothing to provision. Deploy API and Web App in either order (the page shows its error state against an older API). Rollback is reverting the code.

  Stack and constraints respected: API is NestJS with TypeORM and Postgres tested with jest; Web App is React with vitest and Playwright; no new packages (ADR-0016: the Web App reaches data only through the API Service; ADR-0017: access rules enforced in the API; ADR-0030: no tenant scoping, so the counts are plain company totals). The read-only executive is already blocked from non-GET requests by `ReadOnlyGuard`; the new route is GET only and adds no write path, so no audit entry (ADR-0028) is involved.

  UI guidelines check: compact `.card` per summary (one subject per card), no `.btn-primary`, status via `.alert` for the load error, Light theme only, copy is direct and factual. Tokens used: `--space-1`, `--space-3`, `--space-5`, `--space-6`, `--font-size-xs`, `--font-size-sm`, `--font-size-xl`, `--font-weight-medium`, `--font-weight-semibold`, `--color-fg-muted`. Contrast: the prototype overrides `.badge` colour to `var(--color-fg)`, already done by `records.css` line 46.

  ```mermaid
  flowchart TD
    App[App.tsx - route /dashboards/executive]:::touched --> Page[ExecutiveDashboardPage]:::touched
    Nav[Navigation.tsx - executive link]:::touched --> App
    Page --> Layout[RecordsLayout - current prop]:::touched
    Page --> Client[dashboardsClient.ts]:::touched
    Client -->|GET /dashboards/executive| Ctl[DashboardsController]:::touched
    Ctl --> Guards[SessionGuard, ReadOnlyGuard, PermissionGuard]
    Guards --> Policy[permissions.ts - dashboards:executive]:::touched
    Ctl --> Svc[DashboardsService]:::touched
    Svc --> Emp[Employee entity]
    Svc --> Leave[LeaveEntry entity]
    Mod[DashboardsModule]:::touched --> Ctl
    classDef touched fill:#f96,color:#000
  ```
review_focus: |
  Hold the change to: one executive-only GET endpoint returning counts only, one page with the prototype's five states, and the policy/nav/route wiring — no drill-down, pay, names, or write path, and no changes to other roles' dashboards. Riskiest parts are the leave-day SQL (date clipping to the leave year and today, inclusive ends, zero when empty) and keeping `dashboards:executive` distinct from the broader `dashboards:read` so managers and HR admins are refused. The leave-year and "taken" definitions and the empty rule (zero headcount and zero leave) are stated assumptions awaiting product confirmation, not oversights.
