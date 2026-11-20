summary: |
  Give a signed-in manager a view-only "My direct reports" page. The API gets a new
  `GET /employees/direct-reports` endpoint that returns only employees whose `managerId` is the caller's own
  Employee id and who have not left, projected to name, job title, department, manager name and contact details
  (no pay, no ids beyond a list key). The Web App gets a `/direct-reports` page built from the approved
  prototype (info alert, count line, bordered result list, empty / loading / error states) with no edit or open
  controls, and the manager's existing "Team" nav entry links to it. "Left" is not modelled today, so the
  Employee entity gains a nullable `leftAt` column that the query filters on.

scope:
  - description: |
      Add a nullable leaver marker to the Employee entity so leavers can be excluded (AC5):
      `@Column({ type: 'timestamptz', nullable: true }) leftAt!: Date | null;` with a doc comment
      "Set when HR marks the employee as having left; null while employed." Nothing in this story sets it.
    files:
      - services/api/src/employees/employee.entity.ts
    rationale: |
      A grep of services/api/src and apps/web/src for leaver/leftAt/terminat/status found no existing marker on
      Employee (only User.status, which is account activation, not employment).
  - description: |
      Add the policy action `'reports:read'` to `Action` in permissions.ts and allow it only for
      `actor.role === 'manager' && actor.employeeId !== null` in `can()`. HR admins, employees and executives are refused
      (the story is the manager's own view; HR already has `/employees`).
    files:
      - services/api/src/access/permissions.ts
      - services/api/src/access/permissions.spec.ts
    rationale: Keeps authorization in the existing pure policy, enforced by PermissionGuard (ADR-0017).
  - description: |
      Add to EmployeesService:
      `directReports(managerEmployeeId: string): Promise<DirectReport[]>` where
      `DirectReport = { id: string; displayName: string; jobTitle: string | null; department: string | null; managerName: string; contactEmail: string | null; phone: string | null }`.
      Query builder on `employees` alias `e`, `.innerJoin(Employee, 'm', 'm.id = e."managerId"')`,
      `.where('e."managerId" = :managerEmployeeId')`, `.andWhere('e."leftAt" IS NULL')`, order by `e."displayName"` ASC,
      explicit `select` of only the projected columns (pay columns never selected). Direct reports only: no recursive CTE,
      so second-level reports (AC3) are structurally excluded. Export `DirectReport` from employee-input.ts next to `ManagerOption`.
    files:
      - services/api/src/employees/employees.service.ts
      - services/api/src/employees/employee-input.ts
      - services/api/src/employees/employees.service.spec.ts
    rationale: Server-side projection means AC2 holds even if a client misbehaves; pay never leaves the API.
  - description: |
      Add to EmployeesController, declared BEFORE `@Get(':id')` so `direct-reports` is not captured as an id:
      ```ts
      @Get('direct-reports')
      @RequirePermission('reports:read')
      directReports(@Req() req: { actor: Actor }) {
        return this.employees.directReports(req.actor.employeeId as string);
      }
      ```
      `can()` guarantees employeeId is non-null here. Document the endpoint and its response schema in employees.openapi.yaml.
    files:
      - services/api/src/employees/employees.controller.ts
      - services/api/docs/employees.openapi.yaml
      - services/api/test/employees.e2e-spec.ts
      - services/api/test/access.e2e-spec.ts
    rationale: Read-only GET, so no audit entry is written (ADR-0028 covers record changes only).
  - description: |
      Web client: add `export type DirectReport = {...}` (same shape as the API) and
      `getDirectReports(): Promise<DirectReport[]>` in employeesClient.ts, `fetch(`${base()}/employees/direct-reports`, { credentials: "include" })`,
      throwing `new Error("Could not load your direct reports.")` when `!res.ok`.
    files:
      - apps/web/src/employees/employeesClient.ts
    rationale: Web App reaches data only through the API Service (ADR-0016).
  - description: |
      New `DirectReportsPage` in RecordsLayout, built from the prototype screen "My direct reports". Page head: `<h1>My direct reports</h1>`
      and `<p className="muted sub">Employees who report directly to you. View only.</p>`.
      States (State union idle/loading/ready/error, loaded in a `useEffect` on mount, retry re-runs the load):
      - ready with rows: `.alert.alert-info` with Icon `info` and "Shows work details only. People who report to your reports, and employees who have left, are not listed.";
        `<p className="muted result-count" role="status">{n} direct report(s)</p>`; `<ul className="result-list" aria-label="Direct reports">` of
        `li.result-row.result-row--report`, left `.col.main` = `.result-name` name + `.muted` "Job title, Department"; right `.col.side` = "Manager: <b>name</b>",
        `.muted` `<a href="mailto:...">` email, `.muted` phone. Null fields are omitted. No button, link to a record, or edit control anywhere (AC4).
      - empty: `.empty-state.card` with Icon `user`, `<p role="status">You have no direct reports.</p>` and the muted line
        "Employees who report to you will appear here once HR sets them as your reports." (AC6).
      - loading: `aria-busy="true"` wrapper, "Loading your direct reports…", three `.row-skel` rows of `.skeleton` bars using `var(--space-4)`/`var(--space-3)` heights (same pattern as EmployeesPage.tsx).
      - error: `.alert.alert-danger role="alert"` "Your direct reports could not be loaded, so no list is shown. Check your connection and try again." plus `.btn.btn-secondary` "Try again".
      Reuse the existing `Icon` component; check that `info` and `user` names exist in apps/web/src/employees/Icon.tsx and add any missing glyph from the prototype's symbol sheet.
    files:
      - apps/web/src/employees/DirectReportsPage.tsx
      - apps/web/src/employees/DirectReportsPage.test.tsx
      - apps/web/src/employees/Icon.tsx
    rationale: Follows EmployeesPage.tsx structure (same layout, skeleton, alert and retry patterns) so the two read alike.
  - description: |
      Styling. Tokens and prototype-utils.css are already loaded in apps/web/src/index.css lines 1-2 (`@import "../../../design-system/tokens.css"` and `prototype-utils.css`),
      and records.css (imported in main.tsx line 5) already defines .result-list, .result-row, .result-name, .meta, .muted, .page-head, .alert, .row-skel.
      `.alert`, `.alert-info`, `.alert-danger`, `.empty-state`, `.card`, `.skeleton`, `.btn-secondary` come from prototype-utils.css. Only new rules, appended to records.css, all token-based:
      `.result-row--report { align-items: flex-start; flex-wrap: wrap; gap: var(--space-2) var(--space-5); }`
      `.result-row--report + .result-row--report { border-top: 1px solid var(--color-border); }` (already covered by the sibling rule, skip if so),
      `.col { display: flex; flex-direction: column; gap: var(--space-1); font-size: var(--font-size-sm); overflow-wrap: anywhere; }`
      `.col b { font-weight: var(--font-weight-medium); }` `.col.main { flex: 1 1 14rem; }` `.col.side { flex: 1 1 18rem; }`
      `.result-list a { color: var(--color-primary); }`. Below 640px the columns stack through flex-wrap (prototype behaviour); the 768px sidebar collapse is already in RecordsLayout/records.css.
    files:
      - apps/web/src/employees/records.css
    rationale: Mirrors the prototype's inline styles on the same tokens; no hex or raw px values.
  - description: |
      Wire the route and nav. In App.tsx add `if (path === "/direct-reports") return <DirectReportsPage />;` before the generic fallback
      (the `/employees/:id` regex does not match it). In Navigation.tsx render the `team` section as `<a href="/direct-reports" className="underline">` the way `employees` links to /employees,
      relabel `team: "My direct reports"` is NOT done: keep the label "Team" to leave navigation tests stable.
    files:
      - apps/web/src/App.tsx
      - apps/web/src/nav/Navigation.tsx
      - apps/web/src/nav/Navigation.test.tsx
      - apps/web/src/App.test.tsx
    rationale: The manager already has a "Team" section in navigation.ts that today is plain text, so it is the natural entry point.
  - description: |
      Playwright e2e (apps/web/e2e/employees.spec.ts style): sign in as a manager, open /direct-reports, assert rows and absence of edit controls and of second-level / leaver names.
    files:
      - apps/web/e2e/direct-reports.spec.ts
    rationale: End-to-end check across Web App, API and DB.

tests:
  - |
    AC1 (policy + service + e2e). Write first, expect failure because `reports:read` and `directReports` do not exist.
    ```ts
    // permissions.spec.ts
    expect(can({ id: 'u', role: 'manager', employeeId: 'm1' }, 'reports:read')).toBe(true);
    expect(can({ id: 'u', role: 'employee', employeeId: 'e1' }, 'reports:read')).toBe(false);
    expect(can({ id: 'u', role: 'hr_admin', employeeId: 'h1' }, 'reports:read')).toBe(false);
    expect(can({ id: 'u', role: 'manager', employeeId: null }, 'reports:read')).toBe(false);
    // employees.service.spec.ts
    expect(qb.where).toHaveBeenCalledWith('e."managerId" = :managerEmployeeId', { managerEmployeeId: 'm1' });
    // employees.e2e-spec.ts: manager m1 with reports a and b
    const res = await request(app.getHttpServer()).get('/employees/direct-reports').set('Cookie', managerCookie).expect(200);
    expect(res.body.map((r: { displayName: string }) => r.displayName)).toEqual(['Amara Osei', 'Tom Brennan']);
    // access.e2e-spec.ts: employee and hr_admin get 403 { code: 'forbidden' }
    ```
  - |
    AC2 (projection). Service spec asserts the select list holds no pay column, and the e2e asserts the exact keys:
    ```ts
    expect(Object.keys(res.body[0]).sort()).toEqual(
      ['contactEmail', 'department', 'displayName', 'id', 'jobTitle', 'managerName', 'phone'],
    );
    expect(res.body[0]).not.toHaveProperty('payAnnualMinor');
    expect(res.body[0].managerName).toBe('Daniel Okafor');
    ```
    Web: `DirectReportsPage.test.tsx` renders one report and asserts `screen.getByText('Senior Analyst, Finance')`, `screen.getByText('Daniel Okafor')`,
    `screen.getByRole('link', { name: 'priya.natarajan@example.com' })` has `href` `mailto:priya.natarajan@example.com`, and the phone text.
  - |
    AC3 (no second level). e2e seeds m1 -> a -> c (c reports to a). Expect:
    ```ts
    expect(names).toContain('A'); expect(names).not.toContain('C');
    ```
    Playwright spec asserts the same in the rendered list.
  - |
    AC4 (view-only). Component test:
    ```ts
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link', { name: /edit|open/i })).toBeNull();
    ```
    (the error state is the only place a button, "Try again", may exist, and that is covered separately.) Also a PATCH is not exposed by the new route: nothing to test beyond the existing record:write policy.
  - |
    AC5 (leavers). Service/e2e: employee b has `leftAt = new Date()`; expect `names` not to contain b. Service spec asserts
    `expect(qb.andWhere).toHaveBeenCalledWith('e."leftAt" IS NULL')`. Web page test with a response that omits the leaver renders only the others, and the info alert text mentions employees who have left.
  - |
    AC6 (empty). Component test, API mocked to `[]`:
    ```ts
    expect(await screen.findByText('You have no direct reports.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Direct reports' })).toBeNull();
    ```
    e2e: a manager with no reports gets `[]` with 200.
  - |
    States (design loading and error). Loading renders `aria-busy` and "Loading your direct reports…" while the fetch is pending; a rejected fetch renders
    `role="alert"` with "Your direct reports could not be loaded" and a "Try again" button that calls `getDirectReports` a second time.
  - |
    Wiring. `App.test.tsx`: signed in as manager at `/direct-reports` renders the "My direct reports" heading; `Navigation.test.tsx`: manager's "Team" is a link with `href="/direct-reports"`, employee has no Team item.

assumptions_or_open_questions:
  - |
    Nothing in the codebase marks an employee as having left, and no story in this plan sets it. I added a nullable `leftAt` timestamp as the marker. Is that the intended model (vs. a status enum from another Employee Records story)? Whichever story lets HR mark a leaver must write this same column, or this filter must be re-pointed.
  - |
    Schema delivery: app.module.ts line 26 sets `synchronize: process.env.NODE_ENV !== 'production'`, and I found no migrations directory or "migration" reference under services/api. I could not confirm how the production schema is applied; a human must confirm how the new nullable column reaches production.
  - |
    The open project-wide question on how long leaver records are retained does not affect this story: leavers are hidden here, not deleted.
  - |
    The settled decision about absent managers (leave requests move to the manager's own manager) concerns leave approval, not this list; it is not implemented here. Likewise the list shows only the signed-in manager's direct reports, never an absent manager's team.
  - |
    Access: only role `manager` with a linked Employee can call the endpoint; HR admins keep using /employees. Confirm HR admins who also manage people should not see this page.
  - |
    The prototype's "Account" sidebar item and its brand text "HR Records" differ from the live RecordsLayout ("Acme HR", no Account item). I kept RecordsLayout as is and did not copy the prototype's hand-drawn sidebar.
  - |
    The prototype's sample people and emails are sample data only; production data comes from the new endpoint.
  - |
    The sidebar highlights "Records" (href /employees, which is HR-only) as the current page on this screen, as in the prototype. A manager clicking it would be refused by the API. Left unchanged as navigation rework is out of scope.
  - |
    The prototype shows no top bar controls; the live RecordsLayout has a menu button top strip, which is kept unchanged.

estimated_points: 5

package_dependencies: []

notes: |
  ### Data & rollout
  - **Existing data**: one new nullable column `employees."leftAt" timestamptz` with no default. Existing rows get NULL, which means "has not left", so every current employee stays visible and usable. No NOT NULL, FK, unique or enum change.
  - **Backfill / seed**: none needed. Test data for the e2e spec is created by the spec itself.
  - **Settings**: none.
  - **Provisioning**: the column must exist before the new code runs. Non-production gets it through TypeORM `synchronize`; production schema delivery is an open question above.
  - **Order and rollback**: apply the column first, then deploy the API, then the Web App. Rollback: redeploy the old code and leave the nullable column in place (harmless), or drop it.

  Test that existing rows remain usable: an e2e case saves an Employee without `leftAt` and expects it to appear in its manager's list.

  Project context used: stack is NestJS + TypeORM + Postgres (jest) and React + Tailwind + vitest + Playwright, all pnpm. Narrow test commands:
  `(cd services/api && pnpm test -- employees.service.spec.ts permissions.spec.ts)`, `(cd services/api && pnpm test:e2e -- employees.e2e-spec.ts)` if that script exists, `(cd apps/web && pnpm run test -- DirectReportsPage.test.tsx)`.

  UI tokens used: `--space-1..5`, `--color-border`, `--color-primary`, `--color-fg-muted`, `--font-size-sm`, `--font-weight-medium`, `--radius-md`. Nothing in the plan uses a hex or px literal.
  Classes used and where they are defined: `.alert*`, `.empty-state`, `.card`, `.skeleton`, `.btn-secondary` in design-system/prototype-utils.css (loaded by index.css); `.result-*`, `.muted`, `.page-head`, `.row-skel` in apps/web/src/employees/records.css.

  ```mermaid
  flowchart TD
    App[App.tsx route] --> Page[DirectReportsPage]
    Nav[Navigation.tsx Team link] --> App
    Page --> Client[employeesClient.ts]
    Page --> Layout[RecordsLayout]
    Client --> Ctrl[EmployeesController]
    Ctrl --> Guard[PermissionGuard]
    Guard --> Policy[permissions.ts]
    Ctrl --> Svc[EmployeesService]
    Svc --> Entity[Employee entity]
    classDef touched fill:#f96,color:#000
    class App,Page,Nav,Client,Ctrl,Policy,Svc,Entity touched
  ```
  Touched: App and Nav (route and link), Page and Client (new UI and fetch), Ctrl and Svc (new endpoint and query), Policy (new action), Entity (leftAt).

review_focus: |
  In scope: the manager-only direct-reports endpoint, its projection, the leaver filter, and one view-only page with the design's four states. Out of scope: org chart, documents, pay, any way to mark someone as left, and any edit or open-record control. Riskiest areas are the query (must be strictly `managerId = caller` and `leftAt IS NULL`, never recursive, never selecting pay) and the route order in the controller (`direct-reports` before `:id`). The new `leftAt` column is a deliberate assumption because no leaver marker existed; production schema delivery is an open question.
