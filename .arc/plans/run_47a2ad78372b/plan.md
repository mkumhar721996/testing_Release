summary: |
  Give HR admins a company-wide dashboard: current headcount (with a per-department breakdown), leavers in the last 12 months, and total leave taken (days) broken down by leave type, with loading, empty and no-access states, and no pay figures anywhere. Backend: a new HR-admin-only `GET /dashboards/hr-admin` endpoint in the existing NestJS `dashboards` module that aggregates `employees` and `leave_entries` in PostgreSQL, guarded by a new HR-admin-only permission (the existing `dashboards:read` also admits managers and executives, which AC4 forbids), plus a nullable `terminationDate` column on `Employee` because leavers cannot be counted without it. Frontend: a `/dashboard` page in the React web app that builds the approved prototype (three stat cards, headcount-by-department and leave-by-type cards, skeleton, empty and no-access states) on the existing design tokens.
scope:
  - description: |
      Add a nullable termination date to the Employee entity. In `employee.entity.ts` add:
      ```ts
      /** Last day of employment (ISO date). Null while the employee is current. */
      @Column({ type: 'date', nullable: true })
      terminationDate!: string | null;
      ```
      Nothing in the app sets it yet (no ACs for termination), so tests seed it directly. It must never be added to `EmployeeInput`/`FIELD_RULES`, so existing create/update flows are untouched.
    files:
      - services/api/src/employees/employee.entity.ts
    rationale: |
      ACs 6 and 7 count leavers by termination date; the `employees` table has no such column today (read in employee.entity.ts).
  - description: |
      Add a new permission action `'dashboards:hr-admin'` to the `Action` union in `permissions.ts`, allowed only for `actor.role === 'hr_admin'` in `can()`. Leave `dashboards:read` unchanged (manager and executive dashboards belong to other stories).
    files:
      - services/api/src/access/permissions.ts
      - services/api/src/access/permissions.spec.ts
    rationale: |
      AC4. `dashboards:read` returns true for every role except `employee`, so it cannot gate this endpoint.
  - description: |
      Create `DashboardsService` with the signature below, and a pure helper for the leaver window:
      ```ts
      export interface HrAdminDashboard {
        asOf: string;                                   // ISO date used for "today"
        leaversSince: string;                           // ISO date, today minus 12 months
        headcount: number;
        leavers12m: number;
        leaveDays: number;
        headcountByDepartment: { department: string; count: number }[];
        leaveByType: { kind: string; days: number }[];
      }
      export const leaversWindowStart = (today: string): string => /* same day, one year earlier */;
      async hrAdminSummary(): Promise<HrAdminDashboard>
      ```
      Rules, all computed in SQL via `Repository.createQueryBuilder` and `clock.now()` (the existing `Clock` abstraction in `auth/clock.ts`, so tests can fix the date):
      - headcount = employees where `terminationDate IS NULL OR terminationDate > today`, grouped by `COALESCE(department, 'Unassigned')`, across every department (AC1, AC2). `headcount` equals the sum of the groups.
      - leavers12m = employees where `terminationDate >= leaversWindowStart(today) AND terminationDate <= today` (AC6, AC7); the lower bound is inclusive, matching the prototype note "on or after 20 Nov 2025".
      - leave = `SUM("endDate" - "startDate" + 1)` per `kind` over leave entries with `startDate <= today`, for every employee; `leaveDays` is the sum of the groups (AC3, AC8).
      - The result type has no pay fields and the service never selects `payAnnualMinor` or `payCurrency` (AC5). Read-only, so no audit entry (ADR-0028 applies to record changes).
    files:
      - services/api/src/dashboards/dashboards.service.ts
      - services/api/src/dashboards/dashboards.service.spec.ts
    rationale: |
      One service owns the aggregation so the controller stays thin like `LeaveController`. Aggregating in the database keeps the response small and meets ADR-0025 sizing (thousands of users) without loading rows into the API process.
  - description: |
      Add the endpoint to `DashboardsController` (keep the existing `list()`), and wire the service and clock in the module:
      ```ts
      @Get('hr-admin')
      @RequirePermission('dashboards:hr-admin')
      hrAdmin(): Promise<HrAdminDashboard> { return this.dashboards.hrAdminSummary(); }
      ```
      `DashboardsModule` imports `TypeOrmModule.forFeature([Employee, LeaveEntry])` and provides `DashboardsService` and `{ provide: Clock, useClass: SystemClock }` (same pattern as `auth.module.ts:41`). The existing `@UseGuards(SessionGuard, ReadOnlyGuard, PermissionGuard)` gives 401 without a session and 403 for non-HR roles, and the 403 body carries no figures (AC4).
    files:
      - services/api/src/dashboards/dashboards.controller.ts
      - services/api/src/dashboards/dashboards.module.ts
      - services/api/test/dashboards.e2e-spec.ts
    rationale: |
      Follows the existing controller/guard conventions (ADR-0016/0017: the web app reaches data only through the API Service, which enforces authorization).
  - description: |
      Web data layer: `dashboardsClient.ts` exporting the `HrAdminDashboard` type (mirror of the API type, no pay fields) and
      ```ts
      export type DashboardResult =
        | { kind: "ok"; data: HrAdminDashboard }
        | { kind: "forbidden" }
        | { kind: "error" };
      export async function getHrAdminDashboard(): Promise<DashboardResult>
      ```
      using `fetch(`${base()}/dashboards/hr-admin`, { credentials: "include" })` like `employeesClient.ts`; 403 maps to `forbidden`, other non-OK or network failure to `error`.
    files:
      - apps/web/src/dashboards/dashboardsClient.ts
    rationale: |
      Mirrors `employeesClient.ts`; keeps fetch details out of the page so tests mock one module.
  - description: |
      `HrAdminDashboardPage` (`{ role: Role }` prop, wrapped in `RecordsLayout` with `Dashboard` current) building the approved prototype's "HR admin dashboard" screen:
      - Page head: `h1` "HR admin dashboard" (`--font-size-xl`, `--font-weight-semibold`) and intro "Company-wide headcount and leave. Figures include every department." (`--font-size-sm`, `--color-fg-muted`).
      - Default state: `.grid-3` of three `.card`s with a `.stat` (value `--font-size-xl`; label `--font-size-sm`/`--font-weight-medium`; note `--font-size-xs`/`--color-fg-muted`): "Current headcount" (note "All N departments"), "Leavers, last 12 months" (note "Termination date on or after {leaversSince, formatted}"), "Total leave taken, company-wide" (value "N days", note "All leave types"). Below, a `.grid-2` of two `.card.breakdown`: "Headcount by department" and "Leave taken by leave type". Each row is name + tabular-nums value with a `.meter` bar (width = share of total, inline percentage; `--color-bg-inset` track, `--color-primary` fill, `--space-1` height) and a bold "Total" row with `--color-border-strong` top border.
      - Loading: three `.card` skeleton blocks (`--space-6` height) over two (`calc(var(--space-6) * 4)`), `aria-busy="true"`, and a `role="status"` line "Loading headcount and leave figures…".
      - Empty (AC9): when `headcount === 0 && leavers12m === 0 && leaveDays === 0`, render only `.empty-state` "No headcount or leave data matches this dashboard yet." plus a `.btn.btn-secondary` "Refresh" that refetches; no figures are rendered.
      - No access (AC4): when `role !== "hr_admin"` (no fetch is made) or the API answers `forbidden`, render only `.alert.alert-warning` `role="alert"` "You do not have access to the HR admin dashboard." and no figures.
      - Error (not in the prototype, required by the loading/empty/error rule): `.alert.alert-danger` `role="alert"` "The dashboard did not load, so no figures are shown. Check your connection and try again." with a secondary "Try again" button.
      - The page renders no pay or salary text (AC5). `.btn-primary` is not used (the screen has no primary action, per UI guidelines).
      Styles go in `dashboard.css` (imported in `main.tsx` next to `records.css`), defining `.stat`, `.breakdown`, `.list-item`, `.row.between`, `.meter` and `.state-block` from the prototype's inline `<style>` on tokens only: `--space-1`..`--space-6`, `--color-border`, `--color-border-strong`, `--color-bg-inset`, `--color-primary`, `--color-fg-muted`, `--font-size-xs|sm|lg|xl`, `--font-weight-medium|semibold`, `--radius-full`. At 768px and below, `.grid-3`/`.grid-2` collapse to one column (the shell already hides the sidebar behind the menu button, `records.css`).
    files:
      - apps/web/src/dashboards/HrAdminDashboardPage.tsx
      - apps/web/src/dashboards/HrAdminDashboardPage.test.tsx
      - apps/web/src/dashboards/dashboard.css
      - apps/web/src/main.tsx
    rationale: |
      Reuses classes already loaded through `index.css` (`.card`, `.grid-2`, `.grid-3`, `.skeleton`, `.empty-state`, `.alert-warning`, `.btn-secondary` come from `design-system/prototype-utils.css`), so only the prototype's own inline classes need defining.
  - description: |
      Route and shell: in `App.tsx` add `if (path === "/dashboard") return <HrAdminDashboardPage role={user.role} />;` before the fallback. In `RecordsLayout.tsx` turn the `dashboard` section into a link (`href: "/dashboard"`) and add a `current` prop (default `"records"`) so `aria-current="page"` follows the open section instead of being hard-coded on Records.
    files:
      - apps/web/src/App.tsx
      - apps/web/src/employees/RecordsLayout.tsx
      - apps/web/e2e/dashboard.spec.ts
    rationale: |
      The app routes by `window.location.pathname` in `Shell` (no router library), and the UI guidelines put Dashboard first in the sidebar.
tests:
  - |
    AC1 (API e2e, services/api/test/dashboards.e2e-spec.ts, written first and failing with 404): HR admin sees current headcount. Seed 3 active employees plus one terminated 2 years ago, then
    `const res = await hr.get('/dashboards/hr-admin').expect(200); expect(res.body.headcount).toBe(3 + hrAdminsAndOthersSeeded);`
    (assert against the exact seeded count after clearing or counting rows first, since `access.e2e-spec.ts` shares one database).
  - |
    AC2 (API e2e): employees in Finance, People and a null department all count.
    `expect(res.body.headcount).toBe(sum(res.body.headcountByDepartment.map(d => d.count)));`
    `expect(res.body.headcountByDepartment).toEqual(expect.arrayContaining([{ department: 'Finance', count: 2 }, { department: 'Unassigned', count: 1 }]));`
  - |
    AC3 (API e2e plus service spec): leave across employees is summed company-wide. Two employees, entries 2026-02-02..2026-02-03 (2 days) and 2026-03-02..2026-03-02 (1 day):
    `expect(res.body.leaveDays).toBe(3);`
  - |
    AC4 (API e2e, and web unit): each of `employee`, `manager`, `read_only_executive` gets 403 with no figures, an unauthenticated request gets 401:
    `await asManager.get('/dashboards/hr-admin').expect(403); expect(res.body.headcount).toBeUndefined();`
    Permission unit in `permissions.spec.ts`: `expect(can(actor('manager'), 'dashboards:hr-admin')).toBe(false); expect(can(actor('hr_admin'), 'dashboards:hr-admin')).toBe(true);`
    Web unit in `HrAdminDashboardPage.test.tsx`: `render(<HrAdminDashboardPage role="manager" />); expect(screen.getByRole('alert')).toHaveTextContent('You do not have access to the HR admin dashboard.'); expect(client.getHrAdminDashboard).not.toHaveBeenCalled(); expect(screen.queryByText('Current headcount')).not.toBeInTheDocument();`
    Also a forbidden API result for an `hr_admin` prop renders the same alert.
  - |
    AC5 (API e2e and web unit): seed employees with `payAnnualMinor` and `payCurrency`, then
    `expect(JSON.stringify(res.body)).not.toMatch(/pay|salary/i);`
    Web: after rendering the default state with fixture data, `expect(document.body.textContent).not.toMatch(/pay|salary/i);` (the leave type name "Unpaid leave" in a fixture must be avoided or the regex narrowed to `/\bpay\b|salary/i`).
  - |
    AC6 (service spec with a fixed Clock at 2026-11-20, and API e2e): an employee terminated on 2026-06-01 and one terminated exactly on 2025-11-20 (inclusive boundary) are counted:
    `expect(summary.leavers12m).toBe(2);` and the leavers are not in `headcount`.
  - |
    AC7 (service spec, fixed Clock 2026-11-20): an employee terminated on 2025-11-19 is not counted:
    `expect(summary.leavers12m).toBe(0);`
    Helper unit: `expect(leaversWindowStart('2026-11-20')).toBe('2025-11-20');`
  - |
    AC8 (API e2e and web unit): leave in annual and sick kinds is broken down by kind:
    `expect(res.body.leaveByType).toEqual(expect.arrayContaining([{ kind: 'annual', days: 5 }, { kind: 'sick', days: 2 }])); expect(res.body.leaveDays).toBe(7);`
    Web: `expect(within(screen.getByRole('region', { name: 'Leave taken by leave type' })).getByText('260 days')).toBeInTheDocument();` for the Annual leave row, with the Total row equal to the stat card value.
  - |
    AC9 (web unit and Playwright): API returns all zeros and empty arrays, so
    `expect(await screen.findByText('No headcount or leave data matches this dashboard yet.')).toBeInTheDocument(); expect(screen.queryByText('Current headcount')).not.toBeInTheDocument();`
    Clicking "Refresh" calls `getHrAdminDashboard` a second time and shows the figures when the mock now returns data. API e2e with no employees and no leave returns zeros and empty arrays (200, not an error).
  - |
    Loading and error states (web unit): a pending promise shows `screen.getByRole('status')` "Loading headcount and leave figures…" with `aria-busy`; a rejected or `error` result shows the danger alert and a "Try again" button that refetches.
  - |
    Existing rows still readable after the new column (API e2e): save an Employee without `terminationDate`, reload it, `expect(stored.terminationDate).toBeNull();` and confirm it is counted in headcount.
  - |
    Playwright (apps/web/e2e/dashboard.spec.ts, route-mocked like employees.spec.ts): signed in as `hr_admin` with `/dashboards/hr-admin` mocked, `await page.goto('/dashboard'); await expect(page.getByText('Current headcount')).toBeVisible();`; signed in as `employee`, `await expect(page.getByRole('alert')).toContainText('You do not have access');`
  - |
    Narrow run commands (derived from the project command): `(cd services/api && pnpm test -- dashboards permissions)`, `(cd services/api && pnpm run test:e2e -- dashboards)`, `(cd apps/web && pnpm run test -- HrAdminDashboardPage)`; then the full project command before finishing.
assumptions_or_open_questions:
  - |
    `Employee` has no termination date today, and no screen or endpoint sets one. This plan adds the column only; setting it (an HR "terminate employee" action on the record) is not in any AC and is left to a separate story. Until then the leavers figure is 0 in a real deployment. Please confirm this is acceptable or add a story.
  - |
    Production schema management is unclear. `app.module.ts` sets `synchronize` only when `NODE_ENV !== 'production'`, and I found no migrations directory or TypeORM migration config under `services/api` (searched `src` and `package.json`). The new column is nullable with no default, so it is additive and safe for existing rows, but whoever deploys must add the column in production by whatever mechanism the project settles on.
  - |
    "Leave taken" definition. `LeaveEntry` has only `startDate`, `endDate` and `kind` (no status, no approval, no half days), so I count every entry whose `startDate` is on or before today, as calendar days inclusive of both ends, with no time window (the story does not give one). Entries that span today count in full. Leave from employees who have since left is included because the scope is company-wide. If the approval flow (STORY-024) adds a status column, only approved leave should count; please confirm.
  - |
    "Current headcount" counts employees with no termination date or one after today, including HR admins, managers and executives, and counts employees with no sign-in account. Employees with no department are grouped as "Unassigned".
  - |
    The prototype's leave unit is days and its leavers window is "on or after 20 Nov 2025" for today 2026-11-20; I adopted both. `today` is the API server's clock date (UTC), not a per-user time zone. Feb 29 leaves the window start on Feb 28 of the earlier year.
  - |
    Prototype vs shell: the prototype's sidebar lists "Account" as a nav entry, but the UI guidelines place the account menu in the slim top bar. I follow the guidelines and the existing `RecordsLayout` (sidebar Dashboard to Admin only). The prototype's sample data (184 / 9 / 412) is not carried into code.
  - |
    Open question carried from the epic: expected employee population and acceptable dashboard load time. ADR-0025 sizes the system for thousands of users, so plain SQL aggregates with no caching, pagination or Worker job are planned (ADR-0018 only moves long-running work). If a load-time target is set, revisit with indexes on `employees.terminationDate` and `leave_entries.startDate`.
  - |
    Manager and executive dashboards (also in the parent epic) are out of scope here; the `Dashboards` entry in `navigation.ts` and `Navigation.tsx` is left as is. The settled absent-manager decision from STORY-024 does not affect this dashboard.
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout

  - **Existing data**: one additive migration-equivalent: nullable `employees."terminationDate" date`, no default, no constraint. Every existing row gets NULL, meaning "current employee", so all existing employees stay readable and are counted in headcount. No other table changes.
  - **Backfill / seed**: none needed; no seed required. Leavers stay at 0 until termination dates are recorded by a future story.
  - **Settings**: none new. The dashboard reuses `VITE_API_BASE_URL` on the web side (already read in `employeesClient.ts`).
  - **Provisioning**: no new infrastructure. The production database needs the column; the repo has no migrations directory and production disables `synchronize` (see open questions), so that step is owned by the deployer.
  - **Order and rollback**: add the column first, then deploy the API (the endpoint selects it), then the web app. Rollback is leaving the column in place (unused nullable column is harmless) or `ALTER TABLE employees DROP COLUMN "terminationDate"` after reverting the API.

  ### Design and token loading

  Tokens are already loaded: `apps/web/src/index.css:1` imports `../../../design-system/tokens.css` and line 2 imports `design-system/prototype-utils.css` (`.card`, `.grid-2/3`, `.skeleton`, `.empty-state`, `.alert-*`, `.btn-*`). `main.tsx:5` imports `employees/records.css` (shell layout); the new `dashboard.css` is imported beside it. No new design-system import is needed. The prototype's own inline classes (`.stat`, `.breakdown`, `.list-item`, `.row.between`, `.meter`, `.state-block`) are not in `design-system/`, so `dashboard.css` defines them on tokens. Note `records.css` restyles `.alert` (margin, icon alignment) and `.page-head` (flex row), so the page should reuse those, with `Icon` for the alert icon as `EmployeesPage.tsx` does.

  ### Shape

  ```mermaid
  flowchart TD
    A[App.tsx Shell route /dashboard] --> P[HrAdminDashboardPage]
    P --> L[RecordsLayout sidebar link]
    P --> C[dashboardsClient]
    C -->|GET /dashboards/hr-admin| K[DashboardsController]
    K --> G[PermissionGuard + can dashboards:hr-admin]
    K --> S[DashboardsService]
    S --> E[Employee entity + terminationDate]
    S --> LE[LeaveEntry entity]
    S --> CL[Clock auth/clock.ts]
    classDef touched fill:#f96,color:#000
    class A,P,L,C,K,G,S,E touched
  ```

  Touched: App.tsx (route), HrAdminDashboardPage and dashboardsClient (new UI and data layer), RecordsLayout (live Dashboard link), DashboardsController and module (new endpoint, providers), permissions.ts (HR-only action for AC4), DashboardsService (aggregation), employee.entity.ts (termination date for ACs 6 and 7). `LeaveEntry` and `Clock` are read as-is.
review_focus: |
  IN scope: the HR-admin dashboard endpoint and page, the HR-only permission, and the additive nullable `terminationDate` column; OUT: setting termination dates, manager and executive dashboards, pay figures, drill-downs, caching. Riskiest areas are the leaver window boundaries (inclusive 12-month start, terminated employees excluded from headcount), the leave-days SQL (inclusive days, `startDate <= today`) and AC4/AC5: no figure or pay field may leak in a 403 body or the response. Deliberate: a new `dashboards:hr-admin` action instead of reusing `dashboards:read` (which admits managers and executives), and `Clock` injection so date tests are deterministic.
