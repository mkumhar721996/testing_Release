summary: |
  HR admins get a working Employee Records area: search employees by name, open a full record, create a record by hand, and edit any field (profile name, job title, department, manager, pay, contact email/phone). Each employee has exactly one manager (a single `managerId`), required on create. Contact email is the only uniqueness check (case-insensitive); a matching name never blocks a save. Non-HR users who open a record see job, manager and pay read-only. The work extends the existing `employees` module in the API Service (NestJS + TypeORM, `Employee` entity, `PermissionGuard`) with new columns, a search endpoint, a create endpoint and a wider PATCH, and adds three new screens in the Web App (Records, Create employee, Employee record) built from the approved prototype and the `design-system/` tokens. Every change is audited in the same transaction (ADR-0028).

scope:
  - description: |
      API data model. Extend the `Employee` entity (currently only `id`, `userId` unique NOT NULL, `displayName`, `managerId`) with nullable columns `jobTitle`, `department`, `payAnnualMinor` (bigint, minor currency units), `payCurrency` (varchar), `contactEmail`, `phone`. Make `userId` nullable (still unique) because HR creates employees who have no sign-in account yet. Add a unique index on `lower(contactEmail)` (partial: where not null). `displayName` is the employee's full name.
      Add a small `AuditEntry` entity (`id`, `actorUserId`, `entity`, `entityId`, `action`, `changes` jsonb, `createdAt`) in `services/api/src/audit/`, registered via `TypeOrmModule.forFeature`, because ADR-0028 requires every record change to be audited by the API Service in the same operation and no audit code exists yet.
    files:
      - services/api/src/employees/employee.entity.ts
      - services/api/src/audit/audit-entry.entity.ts
      - services/api/src/audit/audit.module.ts
    rationale: |
      The record needs somewhere to hold the fields the AC names. New columns are nullable so rows already in `employees` stay valid. Making `userId` nullable is needed because the create form has no user account.
  - description: |
      API service logic in `EmployeesService`. New signatures:

      ```ts
      search(q: string): Promise<Employee[]>                       // ILIKE %q% on displayName, ordered by displayName, limit 50
      create(input: EmployeeInput, actorUserId: string): Promise<Employee>
      update(id: string, patch: Partial<EmployeeInput>, actorUserId: string): Promise<Employee | null>
      options(): Promise<{ departments: string[]; managers: ManagerOption[] }>
      type ManagerOption = { id: string; displayName: string; isExecutive: boolean }
      ```

      `EmployeeInput` = `{ displayName, jobTitle, department, managerId, payAnnual, contactEmail, phone }`. Rules: all fields are required on create, manager included (error code `manager_required`). `managerId` must reference an existing employee (`manager_not_found`). Department must be in the configured list. Email is normalised (trim, lower-case) before saving. A Postgres unique violation on the email index becomes `ConflictException({ code: 'contact_email_taken', employeeId })`. Name is never checked for uniqueness (AC9). `update` and `create` run in one `dataSource.transaction` that also inserts the `AuditEntry`. `update` replaces `managerId` outright, so the record has one manager (AC6, AC11). The job title is overwritten, with no history kept (AC7). `isExecutive` is true when the employee's linked `User.role` is `read_only_executive` (see open questions). The existing `rename()` is kept as a thin call to `update` so current callers still work.
    files:
      - services/api/src/employees/employees.service.ts
      - services/api/src/employees/employees.service.spec.ts
      - services/api/src/employees/employee-input.ts
    rationale: |
      Validation and the single-manager rule live in the service so the controller stays thin. The audit write must share the transaction (ADR-0028). Writes happen only in the API Service (ADR-0017).
  - description: |
      API routes and permissions. Add two actions to `permissions.ts`: `'employees:search'` and `'employees:create'`, both allowed only for `hr_admin` (no target needed). In `EmployeesController` add, declared BEFORE `@Get(':id')` and after `@Get('me')`:
      `@Get() @RequirePermission('employees:search') list(@Query('q') q)`, `@Get('options') @RequirePermission('employees:search')`, and `@Post() @RequirePermission('employees:create')` returning 201. Widen `@Patch(':id')` (still `record:write`, so HR only) to accept any subset of the `EmployeeInput` fields while still accepting the existing `{ displayName }` body. `GET :id` is unchanged, so non-HR users keep their current read access and the existing 403 behaviour. Validation is hand-written, as the existing controller does, so no new dependency is needed. Errors use `{ code }` bodies like the existing ones. Add `EMPLOYEE_DEPARTMENTS` and `PAY_CURRENCY` reads through `ConfigService` (ADR-0027). Register `AuditModule` in `EmployeesModule` and `AppModule`.
    files:
      - services/api/src/access/permissions.ts
      - services/api/src/access/permissions.spec.ts
      - services/api/src/employees/employees.controller.ts
      - services/api/src/employees/employees.module.ts
      - services/api/src/app/app.module.ts
      - services/api/test/employees.e2e-spec.ts
    rationale: |
      Reuses the existing `SessionGuard`, `ReadOnlyGuard` and `PermissionGuard` chain, so the API stays the only enforcement point and the read-only executive still cannot write.
  - description: |
      Web: load the design system once. In `apps/web/src/index.css`, put `@import "../../../design-system/tokens.css";` and `@import "../../../design-system/prototype-utils.css";` ahead of the `@tailwind` lines (CSS `@import` must come first). Create `apps/web/src/employees/records.css` for the classes the prototype defines only in its own inline `<style>` (`.app`, `.sidebar`, `.side-nav`, `.side-link`, `.main`, `.topstrip`, `.content`, `.page-head`, `.search-row`, `.result-list`, `.result-row`, `.result-name`, `.meta`, `.form-grid`, `.actions`, `.cards`, `.facts`, `.row-skel`, `.title-line`, `.back`, `.menu-btn`, and the `max-width: 768px` and `640px` rules). Copy them as-is: they already use only `var(--token)` values. Import it from `main.tsx`.
    files:
      - apps/web/src/index.css
      - apps/web/src/main.tsx
      - apps/web/src/employees/records.css
    rationale: |
      Today the app loads no tokens (`index.css` holds only the three `@tailwind` directives and `tailwind.config.ts` has an empty `extend`). `.btn`, `.card`, `.field`, `.input`, `.select`, `.badge`, `.alert-*`, `.empty-state`, `.skeleton` and `.is-invalid` are defined in `design-system/prototype-utils.css`; the layout classes above exist only in the prototype, so they are defined in the app.
  - description: |
      Web API client and pages. New `employeesClient.ts` following `shopClient.ts` (`fetch` with `credentials: "include"`, `VITE_API_BASE_URL` base): `searchEmployees(q)`, `getEmployee(id)`, `getEmployeeOptions()`, `createEmployee(input)` and `updateEmployee(id, patch)`. The last two return `{ ok: true, employee } | { ok: false, code, message }`. New pages, each cited to the prototype screen:
      - `EmployeesPage` ("Records" screen): `h1` "Employee records", primary "Create employee" button, `role="search"` form with "Search by name" input and secondary Search button, `result-count` status line, `result-list` rows (name, job title, department, "Manager: <b>name</b>", secondary "Open" button with `aria-label="Open record for <name>"`). States: loading (three `.row-skel` rows, `aria-busy`), empty ("No employee records match this name…" in `.empty-state.card` with "Clear search"), error (`.alert-danger` with "Try again").
      - `EmployeeFormFields` and `EmployeeCreatePage` ("Create employee" screen): two-column `.form-grid` (one column under 640px) with Full name, Job title, Department select, Manager select (single, executives labelled "(Executive)", hint "Required. Choose one manager."), Pay (annual, GBP), Contact email, Phone. Manager missing shows `.alert-danger` "No record was created. Choose a manager and save again." plus `.is-invalid` select with `.field-error` "Manager is required. Choose one manager for this employee." (AC4). A 409 shows the email-duplicate banner and field error (AC8). A same-name match shows the `.alert-info` note and does not block (AC9). Success shows the `.alert-success` banner with "Back to records" and primary "Open record". Cancel is secondary.
      - `EmployeeRecordPage` ("Employee record" screen): four `.card`s (Profile, Job, Pay, Contact details) using `.facts` definition lists, primary "Edit record" button for HR only. Editing swaps to the same form with "Cancel" and primary "Save changes", the manager hint "One manager only. Saving replaces <current>.", and a success `.alert-success` "Changes saved. <Manager> is now <Name>'s only manager." Non-HR users get the `.alert-info` note "You can view this record. Only HR admins can change job, manager or pay." and Job and Pay cards with a "Read-only" `.badge` and no edit control (AC10).
      Routing follows `App.tsx`'s existing pathname checks: `/employees`, `/employees/new`, `/employees/:id`. Add an `Employees` link in `Navigation.tsx` for `hr_admin`. The three pages render inside a small `RecordsLayout` with the prototype's sidebar (Dashboard, Records, Tasks, Reports, Audit Log, Admin in that order, Records current, collapsed behind a menu button under 768px) and slim top bar. Only Records is a live link.
    files:
      - apps/web/src/employees/employeesClient.ts
      - apps/web/src/employees/EmployeesPage.tsx
      - apps/web/src/employees/EmployeesPage.test.tsx
      - apps/web/src/employees/EmployeeFormFields.tsx
      - apps/web/src/employees/EmployeeCreatePage.tsx
      - apps/web/src/employees/EmployeeCreatePage.test.tsx
      - apps/web/src/employees/EmployeeRecordPage.tsx
      - apps/web/src/employees/EmployeeRecordPage.test.tsx
      - apps/web/src/employees/RecordsLayout.tsx
      - apps/web/src/App.tsx
      - apps/web/src/nav/Navigation.tsx
      - apps/web/e2e/employees.spec.ts
    rationale: |
      The screens must run on real API data, not the prototype's inline `#employees` JSON. All styling uses tokens through the design-system classes: `--space-2/3` inside tables and forms, `--space-4/5` between sections, `--color-border`, `--color-bg-subtle`, `--color-primary-subtle`, `--color-danger`, `--color-danger-subtle`, `--color-success-subtle`, `--radius-md`, `--font-size-sm/xl`. No colour or pixel literals.

tests:
  - |
    AC1 (API, `services/api/test/employees.e2e-spec.ts`): write first.
    ```ts
    it('finds an employee by name for an HR admin (AC1)', async () => {
      const admin = await makePerson('hr_admin');
      await makePerson('employee', null, 'Priya Raman');
      const agent = await signedIn(admin.user.email);
      const res = await agent.get('/employees').query({ q: 'priya' }).expect(200);
      expect(res.body.map((e: { displayName: string }) => e.displayName)).toContain('Priya Raman');
    });
    ```
    Also in `employees.service.spec.ts`: `search('priya')` builds an ILIKE on `displayName`.
    Web (`EmployeesPage.test.tsx`): `expect(await screen.findByText('Priya Raman')).toBeInTheDocument()` after typing "Priya" and clicking Search; plus loading, empty (`"No employee records match this name"`) and error (`role="alert"`) states.
  - |
    AC2: `EmployeesPage.test.tsx` clicks `getByRole('button', { name: /open record for priya raman/i })` and expects `navigate`/`location.pathname` to be `/employees/<id>`. `EmployeeRecordPage.test.tsx` expects the four cards: `expect(screen.getByText('Senior Analyst')).toBeInTheDocument()` and the department, manager, pay and email. API e2e: `GET /employees/:id` as HR returns `jobTitle`, `department`, `payAnnualMinor`, `contactEmail`.
  - |
    AC3 (API e2e):
    ```ts
    const res = await admin.post('/employees').send(validBody({ managerId: boss.employee.id })).expect(201);
    const stored = await ds.getRepository(Employee).findOneByOrFail({ id: res.body.id });
    expect(stored.managerId).toBe(boss.employee.id);
    expect(stored.contactEmail).toBe('priya.shah.people@acme.example');
    ```
    Web: filling every field and clicking "Save employee" calls `createEmployee` once and shows `getByRole('status')` "Employee record created for Priya Shah."
  - |
    AC4 (API e2e): `validBody` without `managerId` returns 400 with `code: 'manager_required'`, and `expect(await repo.count({ where: { contactEmail } })).toBe(0)`. Web: `createEmployee` is not called with no manager selected; `expect(screen.getByText(/manager is required/i)).toBeInTheDocument()` and `expect(screen.getByLabelText(/manager/i)).toHaveAttribute('aria-invalid', 'true')`.
  - |
    AC5 (API e2e, `it.each(['displayName','jobTitle','department','managerId','payAnnual','contactEmail','phone'])`): PATCH one field as HR returns 200 and a following `GET` shows the new value. Web: edit job title, click "Save changes", expect the Job card to show the new title.
  - |
    AC6 (API e2e): employee has manager A, PATCH `{ managerId: B }`, then `expect(stored.managerId).toBe(B.id)` and the `GET` body has exactly one manager id (a scalar, not an array). Web: success banner reads "<B> is now <Name>'s only manager."
  - |
    AC7 (API e2e): PATCH `{ jobTitle: 'Y' }` over 'X', then `expect(res.body.jobTitle).toBe('Y')` and `expect(JSON.stringify(res.body)).not.toContain('"X"')`. Web: record page shows `Y` and `queryByText('X')` is null.
  - |
    AC8 (API e2e): create twice with the same email, second with different casing. `await admin.post('/employees').send(dup).expect(409)`, `expect(res.body.code).toBe('contact_email_taken')`, and the employee count is unchanged. Service spec: a Postgres `23505` error maps to `ConflictException`. Web: 409 shows the `alert` "An employee with contact email … already exists. No record was created."
  - |
    AC9 (API e2e): create with an existing employee's `displayName` and a different email returns 201 and two rows share that name: `expect(await repo.count({ where: { displayName } })).toBe(2)`. Web: name-match note is visible and Save still calls `createEmployee`.
  - |
    AC10: API e2e: employee, manager and read-only executive PATCH `{ jobTitle, managerId, payAnnual }` each get 403 and the row is unchanged (extends the existing access spec behaviour). Add `permissions.spec.ts` cases `can(actor('employee'), 'employees:search')` is false and `can(actor('hr_admin'), 'employees:create')` is true. Web (`EmployeeRecordPage.test.tsx`, role `employee`): `expect(screen.queryByRole('button', { name: /edit record/i })).not.toBeInTheDocument()`, the "Read-only" badges appear on Job and Pay, and `expect(screen.getByText(/only hr admins can change job, manager or pay/i)).toBeInTheDocument()`.
  - |
    AC11 (API e2e): an employee with `managerId` null, PATCH `{ managerId: exec.employee.id }` where `exec` is a `read_only_executive` person. Expect 200 and `stored.managerId` to equal the executive's id. `GET /employees/options` lists that person with `isExecutive: true`. Web: the manager select shows "Ada Lindqvist (Executive)" and the saved banner names them.
  - |
    Audit and rollout checks (API e2e): each create and update writes one `AuditEntry` in the same transaction (`expect(await ds.getRepository(AuditEntry).count({ where: { entityId } })).toBe(1)`; a forced failure inside the transaction leaves neither row). Existing-row test: an `employees` row saved with only `userId`, `displayName`, `managerId` is still returned by `GET /employees/:id` and by `GET /employees/me` with null new fields. The existing `access.e2e-spec.ts` cases keep passing unchanged.
  - |
    Playwright (`apps/web/e2e/employees.spec.ts`, routes mocked like `shop.spec.ts`): an HR admin searches "Priya", opens a result, edits the job title, saves, and sees the new title.

assumptions_or_open_questions:
  - |
    Retention of employee documents and leaver records (deferred project question from the epic) does not affect this story. No documents or leavers are handled here and nothing is deleted, so no retention rule is planned.
  - |
    No migrations directory or migration tooling exists in the repo (I looked under `services/api/src`, `services/api/test` and a `migrations` folder). `app.module.ts` uses `synchronize: process.env.NODE_ENV !== 'production'`, so how the production schema is created is unknown. This plan only adds nullable columns, a nullable-ised `userId` and indexes, so `synchronize` can apply them safely. A human must say whether a migration file is required for production.
  - |
    "Designated executive" (AC11) is not defined anywhere in the story. The plan treats an employee whose linked `User.role` is `read_only_executive` as the executive and labels them "(Executive)" in the manager select, as the prototype does. If the designation should be a separate flag, that is a one-column change.
  - |
    Department source. The prototype shows a select (People, Finance, Platform, which the design notes as invented). No department list exists in code. The plan reads a list from the `EMPLOYEE_DEPARTMENTS` env var through `ConfigService` (ADR-0027), default `People,Finance,Platform`. Please confirm the real list or whether departments should be free text.
  - |
    Pay is stored as integer minor units with the currency from `PAY_CURRENCY` (default `GBP`, as in the prototype). Please confirm the currency and whether pay can differ per employee.
  - |
    Prototype vs data model. The prototype shows an "Active" badge and IDs like `EMP-1042`. The story has no status, and `Employee.id` is a uuid with no human-readable ID. The plan omits the Active badge (leavers are a separate story) and shows the uuid in `.mono` in the Profile card. Say if a short employee number should be added.
  - |
    Prototype shows an `.alert-info` name-match note on the create form. AC9 only requires that a matching name does not block the save. The note appears only when the typed name matches an existing employee returned by search, and it is informational.
  - |
    Not in scope, as the story says: import or sync, change history shown to users, employee self-edit of contact details (a separate story; `PATCH` stays HR-only), manager and employee views, documents, leavers. A manager cycle or self-manager check is not required by any AC and is not planned.
  - |
    `ADR-0028` needs an audit trail, but there is none in the repo. This plan adds the smallest `AuditEntry` table written in the same transaction. If the Audit Log story will own the entity, move `audit-entry.entity.ts` there and keep the write call.
  - |
    Whether `design-system/` CSS can be imported by relative path from `apps/web` (outside the Vite root) under the repo's workspace layout is untested. If Vite blocks it, add `@design-system` alias in `vite.config.ts` or `server.fs.allow`.

estimated_points: 8

package_dependencies: []

notes: |
  ### Data & rollout

  - **Existing data**: `employees` rows already exist (`userId`, `displayName`, `managerId`). All new columns (`jobTitle`, `department`, `payAnnualMinor`, `payCurrency`, `contactEmail`, `phone`) are nullable with no default, so old rows stay readable. `userId` goes from NOT NULL to nullable, which no existing row violates. The unique index on `lower(contactEmail)` is partial (`WHERE contactEmail IS NOT NULL`), so rows with no email do not collide. Old rows may have `managerId` null; the API only requires a manager on create and when it is sent on update, so those rows can still be opened and edited.
  - **Backfill / seed**: none. HR enters values by hand (the story says no import). A new `audit_entries` table starts empty.
  - **Settings**: `EMPLOYEE_DEPARTMENTS` (comma list, default `People,Finance,Platform`) and `PAY_CURRENCY` (default `GBP`). Both are safe when unset. Document them in `services/api/.env.example` if that file exists (not checked), otherwise in the service README.
  - **Provisioning**: no new infrastructure. At least one `hr_admin` user with an `employees` row must exist to use the screens; that is already how the access story works.
  - **Order and rollback**: deploy the API before the Web App (the new pages call new routes). Schema changes are additive, so rolling back the code leaves unused nullable columns and an empty-use table that older code ignores. The one non-additive change is `userId` nullable; reverting it needs no row to have a null `userId`, so drop any HR-created rows without an account first.
  - **Test for existing rows**: listed under `tests` ("Existing-row test").

  ### Findings from the code

  - `services/api/src/employees/` already has the entity, `EmployeesService` (`findById`, `rename`), controller (`GET me`, `GET :id`, `PATCH :id`) and a service spec, so this extends them rather than creating a module.
  - `PermissionGuard` already resolves the actor and enforces `record:write` for `hr_admin` only. `permissions.ts` has the comment "Until Employee Records defines who may edit, only HR admins can", which this story settles: no change to that rule.
  - Route order matters: `@Get('me')` and `@Get('options')` must stay above `@Get(':id')`.
  - The Web App has no router, no sidebar shell and no design tokens yet. `App.tsx` switches on `window.location.pathname` and `Navigation` renders plain `<li>` labels. The plan follows that pathname approach rather than adding a router dependency.
  - Existing pages use Tailwind slate utilities. The new pages use the design-system classes instead, as the UI guidelines and prototype require. Existing pages are not restyled.
  - The prototype header comment says its shell is off and the sidebar carries the nav. The plan builds that sidebar once in `RecordsLayout`; the live app shell (`design-system/app-shell.html`) was not opened for this plan and a follow-up may replace the layout.

  ```mermaid
  flowchart TD
    Main[main.tsx] --> Css[index.css + records.css]
    Css --> DS[design-system tokens.css and prototype-utils.css]
    App[App.tsx] --> Nav[Navigation.tsx]
    App --> EP[EmployeesPage]
    App --> CP[EmployeeCreatePage]
    App --> RP[EmployeeRecordPage]
    EP --> Client[employeesClient.ts]
    CP --> Client
    RP --> Client
    Client -->|HTTP| Ctl[EmployeesController]
    Ctl --> Guards[SessionGuard ReadOnlyGuard PermissionGuard]
    Guards --> Perm[permissions.ts]
    Ctl --> Svc[EmployeesService]
    Svc --> Ent[Employee entity]
    Svc --> Audit[AuditEntry entity]
    classDef touched fill:#f96,color:#000
    class Main,Css,App,Nav,EP,CP,RP,Client,Ctl,Perm,Svc,Ent,Audit touched
  ```

  All highlighted nodes are created or modified (new pages and client, widened controller, service and entity, two new actions in `permissions.ts`, new audit entity). `design-system/` and the guards are read-only context.

review_focus: |
  Hold the work to HR create, search, open and edit of employee records plus read-only display for non-HR; self-edit of contact details, import, change history, documents and leavers are out. The riskiest parts are the entity change (`userId` made nullable, new columns with no migration tooling in the repo) and the same-transaction audit write, followed by the route order in `EmployeesController` and the case-insensitive email uniqueness. Deliberate choices: duplicate check is on email only, never name (AC8/AC9); PATCH stays HR-only through the existing `record:write` rule; "designated executive" is inferred from `User.role` and the department list comes from config, both flagged as open questions.
