summary: |
  Let HR admins define leave types (name plus an "exempt" switch) and hand-enter or adjust each employee's balance per leave type, so employees have something to request against. The API Service (NestJS, TypeORM/PostgreSQL) gets two new tables (`leave_types`, `leave_balances`), a new HR-only permission `leave:manage` in the existing pure policy `can`, a leave-types controller and a per-employee balances controller; every write also writes an `AuditEntry` in the same transaction (ADR-0028, as `EmployeesService` already does). The Web App (React, existing `records.css` shell, design-system classes) gets the two approved screens under Admin: "Leave types" and "Employee leave balances". Accrual, carry-over, the request-time balance block (which will honour the stored `exempt` flag) and public holidays are out of scope.
scope:
  - description: |
      Permission. Add `'leave:manage'` to the `Action` union and a case in `can`:
      ```ts
      case 'leave:manage':
        return actor.role === 'hr_admin';
      ```
      No change to `PermissionGuard`/`ReadOnlyGuard`: the action is not a record action (no target row is loaded) and `ReadOnlyGuard` already refuses non-GET for the executive. The employee picker needs no new permission or endpoint: the existing `GET /employees/options` (`employees:search`, hr_admin only) already returns every employee as `{ id, displayName, isExecutive }`.
    files:
      - services/api/src/access/permissions.ts
      - services/api/src/access/permissions.spec.ts
    rationale: |
      AC5. Reuses the existing policy/guard pair (ADR-0017: authorization lives in the API Service).
  - description: |
      Entities (new tables; the repo creates tables via TypeORM `synchronize` outside production, and `autoLoadEntities` picks them up):
      ```ts
      @Entity('leave_types')
      export class LeaveType {
        @PrimaryGeneratedColumn('uuid') id!: string;
        @Column({ unique: true }) name!: string;               // also checked case-insensitively in the service
        @Column({ type: 'boolean', default: false }) exempt!: boolean;
      }

      @Entity('leave_balances')
      @Unique(['employeeId', 'leaveTypeId'])
      export class LeaveBalance {
        @PrimaryGeneratedColumn('uuid') id!: string;
        @Column({ type: 'uuid' }) employeeId!: string;
        @Column({ type: 'uuid' }) leaveTypeId!: string;
        @Column({ type: 'int' }) days!: number;                // whole days, >= 0
      }
      ```
      No row means "not set"; a stored `0` is a real balance of 0 days.
      Also widen `AuditEntry.action` in `audit-entry.entity.ts` from `'create' | 'update'` to `'create' | 'update' | 'delete'` (the column is `varchar`, so no schema change).
    files:
      - services/api/src/leave/leave-type.entity.ts
      - services/api/src/leave/leave-balance.entity.ts
      - services/api/src/audit/audit-entry.entity.ts
    rationale: |
      One row per (employee, type) makes AC4 hold by construction: adjusting one pair never touches another row.
  - description: |
      `LeaveTypesService` (constructor takes `DataSource` like `EmployeesService`; writes run in `dataSource.transaction(async (em) => ...)` and save an `AuditEntry` with `entity: 'leave_type'`, `entityId`, the action and the changed fields in the same transaction):
      ```ts
      list(): Promise<Array<{ id: string; name: string; exempt: boolean; balanceCount: number }>>
      create(input: { name: string; exempt?: boolean }, actorUserId: string): Promise<LeaveType>
      update(id: string, input: { name?: string; exempt?: boolean }, actorUserId: string): Promise<LeaveType>
      remove(id: string, actorUserId: string): Promise<void>
      ```
      Rules: name trimmed, non-empty, unique case-insensitively (else `ConflictException({ code: 'leave_type_name_taken' })`; empty or non-string -> `BadRequestException({ code: 'leave_type_name_invalid' })`); `exempt` must be boolean when present (else `leave_type_exempt_invalid`); unknown id -> `NotFoundException({ code: 'leave_type_not_found' })`; `remove` throws `ConflictException({ code: 'leave_type_in_use' })` when any `leave_balances` row, or any `LeaveEntry` whose `kind` equals the type id, references it, and otherwise deletes it. `list` orders by name and includes `balanceCount` (the design's "Employees with a balance" column).
      `LeaveTypesController` at `@Controller('leave-types')` with `@UseGuards(SessionGuard, ReadOnlyGuard, PermissionGuard)` like `LeaveController`: `GET /` (`leave:read`, so non-HR users see the read-only table the design's forbidden state shows), `POST /`, `PATCH /:id`, `DELETE /:id` (all `leave:manage`; pass `req.actor.id`).
    files:
      - services/api/src/leave/leave-types.service.ts
      - services/api/src/leave/leave-types.service.spec.ts
      - services/api/src/leave/leave-types.controller.ts
    rationale: |
      AC1, AC5-AC10. The service holds the rules so they are unit-testable with mocked repositories (pattern of `employees.service.spec.ts`).
  - description: |
      `LeaveBalancesService` and `LeaveBalancesController` (`@Controller('employees/:id/leave-balances')`, same guard stack, both routes `leave:manage`):
      ```ts
      // GET /employees/:id/leave-balances
      list(employeeId: string): Promise<Array<{ leaveTypeId: string; name: string; exempt: boolean; days: number | null }>>
      // PUT /employees/:id/leave-balances/:leaveTypeId   body { days }
      set(employeeId: string, leaveTypeId: string, days: number, actorUserId: string): Promise<{ leaveTypeId: string; days: number }>
      ```
      `list` returns one row per leave type (ordered by name), `days: null` when HR has not set it. `set` upserts on `(employeeId, leaveTypeId)` inside a transaction with an `AuditEntry` (`entity: 'leave_balance'`, `entityId` the balance row id, changes `{ employeeId, leaveTypeId, days, previousDays }`, action `create` or `update`) and touches only that row. `days` must be a non-negative integer (`Number.isInteger`, type number) else `BadRequestException({ code: 'balance_invalid' })`; unknown employee or leave type -> `NotFoundException`. Both routes are HR-only, so non-HR callers get 403 before any 404.
    files:
      - services/api/src/leave/leave-balances.service.ts
      - services/api/src/leave/leave-balances.service.spec.ts
      - services/api/src/leave/leave-balances.controller.ts
    rationale: |
      AC2-AC5, AC11. A separate controller class beside `EmployeesController` resolves fine because the sub-paths differ (`/employees/:id/leave-balances` vs `/employees/:id`).
  - description: |
      Wire-up in `LeaveModule`: add `LeaveType`, `LeaveBalance` to `TypeOrmModule.forFeature([...])` (`LeaveEntry` stays), register the two controllers and two services. `Employee` comes through `AccessModule`'s `TypeOrmModule` export; `AuditEntry` is registered by `AuditModule` and `autoLoadEntities` covers `em.save(AuditEntry, ...)` inside a transaction, so no extra import is expected (confirm when building; add `AuditModule` to `LeaveModule.imports` only if a repository is injected). `app.module.ts` is unchanged.
    files:
      - services/api/src/leave/leave.module.ts
    rationale: |
      Keeps the feature inside the existing leave module.
  - description: |
      API end-to-end test file (real PostgreSQL, same harness as `access.e2e-spec.ts`: `AppModule`, faked Cognito, `makePerson`, `signedIn`) covering every AC through HTTP, including non-HR refusal, the row-unchanged checks and the audit rows.
    files:
      - services/api/test/leave-admin.e2e-spec.ts
    rationale: |
      AC4, AC5 and AC10 are about stored state, so they are asserted against the database, not mocks.
  - description: |
      Web styling. The tokens are ALREADY loaded: `apps/web/src/index.css` lines 1-2 import `design-system/tokens.css` and `design-system/prototype-utils.css` (so `.btn`, `.btn-primary/-secondary/-ghost/-danger/-sm`, `.card`, `.badge(-warning)`, `.alert(-danger)`, `.modal`, `.backdrop`, `.toast`, `.field`, `.field-label/-hint/-error`, `.input`, `.select`, `.switch`, `.empty-state`, `.skeleton`, `.is-invalid` are all defined there and available). `records.css` (imported in `main.tsx`) already defines the shell (`.app`, `.sidebar`, `.side-link`, `.topstrip`, `.content`, `.page-head`, `.muted`, `.alert` icon colouring, `.badge` contrast fix). Do NOT touch `tailwind.config.ts` or `vite.config.ts`. Add one stylesheet `apps/web/src/leave/leave.css` imported in `main.tsx` after `records.css`, holding only what the design adds on top, written on tokens (no hex, no raw colour; the only raw px values are the ones prototype-utils itself uses): `.tbl` (th `--color-bg-subtle`, `--color-fg-muted`, `--font-weight-medium`; cells `--space-2`/`--space-3`, `--color-border` bottom border, `--font-size-sm`), `.tbl .num` (`--font-weight-semibold`, `--font-size-md`), `.tbl .actions` (right aligned, no wrap), `.tbl-wrap` (padding 0, overflow hidden), `.section` (flex column, `--space-4` gap), `.toolbar` / `.toolbar .field` (`--space-3` gap, min-width), `.switch-row` (`--space-3` gap, min-height `calc(var(--space-6) + var(--space-3))`), `.modal-actions` (flex end, `--space-2` gap, `--space-4` top margin), `.modal h2` (`--font-size-lg`, `--font-weight-semibold`), `.sk-row` skeleton row, `.toast` offset, and the `max-width: 768px` stacked-card rules for `.tbl` (thead visually hidden, `td::before { content: attr(data-label) }`, `.btn { min-height: calc(var(--space-6) + var(--space-3)) }`). Status text keeps `--color-fg` on subtle fills (design v2/v3 contrast fix: never `--color-warning`/`--color-danger` text on body copy; the alert icon alone is `--color-danger`, already in `records.css`).
    files:
      - apps/web/src/leave/leave.css
      - apps/web/src/main.tsx
    rationale: |
      The design's inline `<style>` (page-head, `.tbl`, `.section`, `.toolbar`, `.switch-row`, `.modal-actions`, mobile card rules) has no definition in any loaded stylesheet, so it is defined once in the app on the same tokens, following the `records.css` precedent. UI guidelines: tables degrade to stacked cards under 768px; `btn-primary` is the one primary action per screen; toast only confirms, alert is for refusals.
  - description: |
      Shell. Reuse `RecordsLayout` rather than building a second shell: add an optional prop `active?: "records" | "admin"` (default `"records"`, so existing screens are unchanged) and give the Admin section `href: "/admin/leave-types"`; `aria-current="page"` goes on the active section only. The design's shell footer line is hidden in the approved design, and `RecordsLayout` has none. The top bar search/notifications/account controls from the design's shell are not in `RecordsLayout` today and are not added here (see open questions).
    files:
      - apps/web/src/employees/RecordsLayout.tsx
    rationale: |
      The sidebar with the six guideline sections already exists there; a second copy would drift.
  - description: |
      Web client `leaveClient.ts` (pattern of `employeesClient.ts`: `fetch` with `credentials: "include"`, `import.meta.env.VITE_API_BASE_URL`), returning a discriminated result so screens can tell 403 from other failures:
      ```ts
      export type LeaveType = { id: string; name: string; exempt: boolean; balanceCount: number };
      export type Balance = { leaveTypeId: string; name: string; exempt: boolean; days: number | null };
      export type Result<T> =
        | { ok: true; value: T }
        | { ok: false; reason: "forbidden" | "conflict" | "invalid" | "error"; message: string };
      listLeaveTypes(): Promise<Result<LeaveType[]>>
      createLeaveType(input: { name: string; exempt: boolean }): Promise<Result<LeaveType>>
      updateLeaveType(id: string, input: { name: string; exempt: boolean }): Promise<Result<LeaveType>>
      deleteLeaveType(id: string): Promise<Result<null>>
      listBalances(employeeId: string): Promise<Result<Balance[]>>
      setBalance(employeeId: string, leaveTypeId: string, days: number): Promise<Result<{ leaveTypeId: string; days: number }>>
      ```
      The employee select reuses `getEmployeeOptions()` from `employeesClient.ts` (`managers` is the full employee list); no new client function. The `409` code (`leave_type_name_taken` vs `leave_type_in_use`) is surfaced in `message`/a `code` field so the page picks the right copy.
    files:
      - apps/web/src/leave/leaveClient.ts
    rationale: |
      Keeps all HTTP in one module the page tests can mock (ADR-0016: the Web App reaches data only through the API Service).
  - description: |
      `LeaveTypesPage.tsx` (design screen "Leave types", inside `RecordsLayout active="admin"`): `.page-head` with `<h1>Leave types</h1>`, subtitle "Admin · HR. Define the leave types employees can hold a balance for.", a `btn-secondary` "Employee balances" link to `/admin/leave-balances` and the single `btn-primary` "New leave type". `.card.tbl-wrap` > `<table class="tbl">` with caption "Leave types, with the number of employees who have a balance"; columns Name, Exempt (`<span class="badge badge-warning">Exempt</span>` or `<span class="muted">No</span>`), Employees with a balance, Actions (`btn-ghost btn-sm` Edit/Delete with `aria-label="Edit <name>"` / `"Delete <name>"`). States: loading (`role="status" aria-label="Loading leave types"`, four `.skeleton.sk-row`), empty (`.empty-state` "No leave types yet" / "Employees have nothing to request against until you create a leave type, such as Annual leave." with a primary "New leave type"; show only one primary on the screen), error (`.alert.alert-danger role="alert"` "Leave types did not load." with secondary "Try again"), forbidden (alert "Change refused. Your role is <role>. Only HR admins can create, edit or delete leave types. Ask an HR admin to make this change." above a read-only table, Edit/Delete `disabled`). Type modal (`.backdrop` + `.modal role="dialog" aria-modal="true"`, title "New leave type"/"Edit leave type", Name input, Exempt `<input class="switch" type="checkbox" role="switch">` with hint "Exempt types are not blocked by the balance check.", `.field-error role="alert"` copy "Enter a name for the leave type, for example Annual leave." and "A leave type named <name> already exists. Enter a different name.", buttons Cancel / "Create leave type" or "Save changes"). Delete modal ("Delete <name>? It is removed from the leave types list and cannot be restored.", `btn-danger` "Delete leave type"); on `leave_type_in_use` it shows the in-modal alert "Deletion refused. <name> has a balance for <n> employee(s). Remove those balances first; the leave type stays in the list.", hides the confirm button and relabels Cancel to "Close". `.toast role="status"` confirms "<name> created" / "<name> saved" / "<name> deleted". Modals trap focus, close on Esc, and return focus to the trigger.
      `LeaveBalancesPage.tsx` (design screen "Employee leave balances"): header, "Leave types" secondary button; `.toolbar` with `<label>Employee</label><select class="select">` filled from `getEmployeeOptions()` (option text is the display name; the design's "(department)" suffix is not available from that endpoint); caption "Leave balances for <name>"; table Leave type (+ Exempt badge when exempt) / Balance / Action. `days === null` renders only `<span class="badge">Not set</span>` and no days figure; otherwise `<span class="num">10 days</span>` ("1 day" when 1). Button is "Set balance" (`btn-primary btn-sm`, only when not set) or "Adjust balance" (`btn-secondary btn-sm`) with `aria-label="Set|Adjust <type> balance for <employee>"`. Balance modal: title "Set|Adjust <type> balance", label "<type> days for <employee>", `type="number" min="0" step="1"` input, hint "Whole days, 0 or more.", error "Enter a whole number of days, 0 or more.", buttons Cancel / "Save balance", toast "<type> balance is now N days". States: loading (`role="status"`, three skeleton rows), empty ("No leave types to set balances for" with "Go to leave types"), error ("Balances did not load." + Try again), forbidden ("Change refused. Your role is <role>. Only HR admins can set or adjust leave balances. The balance is unchanged.").
      Routing in `App.tsx` `Shell`: `/admin/leave-types` -> `LeaveTypesPage`, `/admin/leave-balances` -> `LeaveBalancesPage` (inside the signed-in branch, same pathname-matching style as `/employees`). The pages call the API regardless of role (the API is the enforcement point, as `navigation.ts` says), so a non-HR user who types the URL sees the forbidden state. Add a link to `/admin/leave-types` on the signed-in home screen only when `navigationFor(user.role)` includes `admin` (HR admins).
    files:
      - apps/web/src/leave/LeaveTypesPage.tsx
      - apps/web/src/leave/LeaveTypesPage.test.tsx
      - apps/web/src/leave/LeaveBalancesPage.tsx
      - apps/web/src/leave/LeaveBalancesPage.test.tsx
      - apps/web/src/App.tsx
      - apps/web/src/App.test.tsx
      - apps/web/e2e/leave-admin.spec.ts
    rationale: |
      Implements the approved design for AC1-AC3, AC5-AC11 on the UI side, with the five states each screen lists, using only design-system classes and tokens.
tests:
  - |
    AC5 policy (write first, `permissions.spec.ts`):
    ```ts
    it('lets only an HR admin manage leave (AC5)', () => {
      expect(can(actor('hr_admin'), 'leave:manage')).toBe(true);
      for (const role of ['employee', 'manager', 'read_only_executive'] as Role[]) {
        expect(can(actor(role), 'leave:manage')).toBe(false);
      }
    });
    ```
  - |
    AC1 `leave-types.service.spec.ts` (mock repo and `DataSource.transaction` like `employees.service.spec.ts`):
    ```ts
    await expect(service.create({ name: '  Annual leave ' }, 'u1')).resolves.toMatchObject({ name: 'Annual leave', exempt: false });
    expect(em.save).toHaveBeenCalledWith(LeaveType, expect.objectContaining({ name: 'Annual leave', exempt: false }));
    expect(em.save).toHaveBeenCalledWith(AuditEntry, expect.objectContaining({ entity: 'leave_type', action: 'create' }));
    await expect(service.create({ name: '   ' }, 'u1')).rejects.toMatchObject({ response: { code: 'leave_type_name_invalid' } });
    await expect(service.create({ name: 'annual LEAVE' }, 'u1')).rejects.toMatchObject({ response: { code: 'leave_type_name_taken' } });
    ```
    Web `LeaveTypesPage.test.tsx` (mock `./leaveClient`): type "Annual leave", click "Create leave type", then
    `expect(client.createLeaveType).toHaveBeenCalledWith({ name: "Annual leave", exempt: false })` and `expect(await screen.findByRole("cell", { name: "Annual leave" })).toBeInTheDocument()`. A blank name shows `Enter a name for the leave type, for example Annual leave.` and `expect(client.createLeaveType).not.toHaveBeenCalled()`.
  - |
    AC2 `leave-balances.service.spec.ts` and API e2e: `await service.set('e1', 'annual', 10, 'u1')` upserts exactly `{ employeeId: 'e1', leaveTypeId: 'annual', days: 10 }` on conflict paths `['employeeId', 'leaveTypeId']`; e2e: `PUT /employees/:id/leave-balances/:annualId {days:10}` as HR -> 200, then `GET` gives `expect(body.find((b) => b.name === 'Annual leave').days).toBe(10)`. Web `LeaveBalancesPage.test.tsx`: choose employee, click `Set Annual leave balance for Priya Raman`, type 10, "Save balance" -> `expect(client.setBalance).toHaveBeenCalledWith("e1", "annual", 10)` and `expect(await screen.findByText("10 days")).toBeInTheDocument()`. Invalid input (`-1`, `2.5`, empty) shows `Enter a whole number of days, 0 or more.` and does not call `setBalance`; the API rejects the same with 400 `balance_invalid`.
  - |
    AC3 e2e: set Annual to 10, PUT again with `{days: 7}` -> GET shows 7 and exactly one row exists for the pair:
    ```ts
    expect(await ds.getRepository(LeaveBalance).countBy({ employeeId, leaveTypeId })).toBe(1);
    ```
    Web: with Annual at 10 the button is "Adjust balance"; after saving 7, `expect(await screen.findByText("7 days")).toBeInTheDocument()` and `expect(screen.queryByText("10 days")).toBeNull()`.
  - |
    AC4 e2e (stored state):
    ```ts
    await put(annual, 10); await put(sick, 5); await put(sick, 3);
    const rows = (await get()).body;
    expect(rows.find((r) => r.name === 'Annual leave').days).toBe(10);
    expect(rows.find((r) => r.name === 'Sick leave').days).toBe(3);
    ```
    Service spec: `set` writes only the given (employee, type) pair; no other row is read for update or saved.
  - |
    AC5 e2e (`leave-admin.e2e-spec.ts`), for each of employee, manager, read_only_executive:
    ```ts
    await agent.post('/leave-types').send({ name: 'Study leave' }).expect(403);
    await agent.put(`/employees/${emp.id}/leave-balances/${annual.id}`).send({ days: 99 }).expect(403);
    expect(await ds.getRepository(LeaveType).countBy({ name: 'Study leave' })).toBe(0);
    expect(await ds.getRepository(LeaveBalance).countBy({ employeeId: emp.id })).toBe(0);
    ```
    Also PATCH and DELETE on a leave type are 403, GET `/employees/:id/leave-balances` is 403, and no session gives 401. Web: when `createLeaveType` resolves `{ ok: false, reason: "forbidden" }` the page shows a `role="alert"` containing "Change refused" and the list is unchanged; when `listLeaveTypes` works for a non-HR role the Edit/Delete buttons render `disabled`.
  - |
    AC6 `leave-types.service.spec.ts` + e2e: `await service.update('unpaid', { exempt: true }, 'u1')` saves `exempt: true`; e2e `PATCH /leave-types/:id {exempt:true}` then `GET /leave-types` -> `expect(body.find((t) => t.name === 'Unpaid leave').exempt).toBe(true)`. Web: editing "Unpaid leave", clicking `getByRole("switch", { name: "Exempt" })` and "Save changes" calls `expect(client.updateLeaveType).toHaveBeenCalledWith("unpaid", { name: "Unpaid leave", exempt: true })`; the row then shows `Exempt` (`within(row).getByText("Exempt")`).
  - |
    AC7 e2e + web: starting from `exempt: true`, `PATCH {exempt:false}` -> `GET` shows `exempt` false; web: after toggling the switch off and saving, `expect(within(row).queryByText("Exempt")).not.toBeInTheDocument()` and the cell reads "No".
  - |
    Rename and delete rules (not an AC but part of the item's "maintain" behaviour; keep tests small): `service.update(id, { name: 'Annual holiday' }, 'u1')` saves the new name; renaming to another type's name in any case -> 409 `leave_type_name_taken`. Delete with no balance and no `LeaveEntry` whose `kind` equals the id calls the delete once and writes a `delete` audit entry; with a balance (or such an entry) it rejects `leave_type_in_use` and deletes nothing:
    ```ts
    await expect(service.remove(annual.id, 'u1')).rejects.toMatchObject({ response: { code: 'leave_type_in_use' } });
    expect(em.delete).not.toHaveBeenCalled();
    // e2e
    await hr.delete(`/leave-types/${annual.id}`).expect(409);
    expect(await ds.getRepository(LeaveType).findOneBy({ id: annual.id })).not.toBeNull();
    ```
    Web: `deleteLeaveType` resolving `{ ok: false, reason: "conflict" }` shows `Deletion refused. Annual leave has a balance for 2 employees.` and `expect(screen.getByRole("cell", { name: "Annual leave" })).toBeInTheDocument()` still holds.
  - |
    AC11 service spec + e2e + web: an employee with an Annual balance and no Sick row -> `list(employeeId)` returns `{ name: 'Sick leave', days: null }`, distinct from a stored 0 which returns `0`:
    ```ts
    expect(sick.days).toBeNull();
    expect(zero.days).toBe(0);
    ```
    Web: for `{ name: "Sick leave", days: null }` the row has the "Not set" badge and `expect(within(row).queryByText(/day/)).not.toBeInTheDocument()`.
  - |
    Audit and guard checks (e2e): after create, rename, exempt toggle, delete and a balance set, `audit_entries` holds one row per change with `entity` `leave_type` or `leave_balance`; a refused change (403, 409, 400) writes none. `GET /leave-types` is 200 for every signed-in role. `PUT` with `{days: -1}`, `{days: 2.5}`, `{days: "3"}` -> 400 `balance_invalid`; unknown employee id or leave type id -> 404. `App.test.tsx`: at `/admin/leave-types` a signed-in `hr_admin` sees the "Leave types" heading; the home screen shows the admin link only for `hr_admin`. `RecordsLayout` existing tests still pass with the default `active`.
  - |
    Playwright `e2e/leave-admin.spec.ts` (routes mocked like `access.spec.ts`): as `hr_admin`, `page.goto('/admin/leave-balances')` shows "Not set" for Sick leave and no days text in that row; creating a leave type through the modal makes it appear in the table. Narrow command forms: `(cd services/api && pnpm test -- leave-types.service.spec.ts leave-balances.service.spec.ts permissions.spec.ts)`, `(cd services/api && pnpm test:e2e -- leave-admin.e2e-spec.ts)`, `(cd apps/web && pnpm run test -- src/leave)`, `(cd apps/web && pnpm e2e -- leave-admin.spec.ts)`.
assumptions_or_open_questions:
  - |
    Open: how a leave request links to a leave type. The only existing leave record is `LeaveEntry` with a free-text `kind` string and no foreign key (read in `leave-entry.entity.ts`), and leave requests are a later story. For delete refusal the plan treats a `LeaveEntry` as referencing a type when `kind` equals the type's id; the balance-based refusal does not depend on this. Say if the requests story will store the type name instead.
  - |
    Open: the design's delete rule is "a leave type with any employee balance cannot be deleted" (design plan comment). That is a design rule, not one of the seven ACs; the plan builds it because the screen shows the refusal. Confirm HR is expected to clear balances first, since this item has no "remove a balance" action (balances can only be set to 0, which still counts as a balance).
  - |
    Assumed: balances are whole days, 0 or more, no upper bound (design: "Whole days, 0 or more"); names are unique case-insensitively (design duplicate-name copy).
  - |
    Assumed: non-HR users can read the leave types list (`GET /leave-types` uses `leave:read`) because the design's forbidden state shows a read-only table; only changes are refused (AC5). `GET /employees/:id/leave-balances` is HR-only; employees seeing their own balance is not in these criteria.
  - |
    Assumed: the `exempt` flag is only stored and shown here; the balance block that honours it belongs to the leave-request story (settled project decision: each leave type has an exempt setting HR can turn on). Public-holiday dates and absent-manager routing are other stories' decisions and are not built here.
  - |
    Assumed: the design's top bar (search, notifications, account) is not built; the existing `RecordsLayout` has only the sidebar and a menu button, and other sidebar sections stay disabled placeholders. Say if this story should add the full top bar.
  - |
    Open: the employee select shows display names only; the design shows "Name (department)" but `GET /employees/options` returns no department. Adding it would mean extending that endpoint; left out unless the reviewer wants it.
  - |
    Open: no token covers the 44px touch-target minimum used by the design's mobile rule; the plan uses `calc(var(--space-6) + var(--space-3))`, the same expression the design shell uses, rather than a raw pixel value.
estimated_points: 8
package_dependencies: []
notes: |
  ### Data & rollout
  - **Existing data**: two new tables only (`leave_types`, `leave_balances`); no existing table or column changes, so existing `employees`, `leave_entries`, `users` and `audit_entries` rows are untouched. The `AuditEntry.action` union widening is type-only (the column is `varchar`). No foreign keys to existing tables, so no old row can violate a constraint.
  - **Backfill / seed**: none. With no leave types the screens show their empty states and HR creates the types through the UI.
  - **Settings**: none. No new env var or config file.
  - **Provisioning**: `AppModule` sets `synchronize: process.env.NODE_ENV !== 'production'` and the repo has no migrations directory (searched `services/api/src`), so in production `leave_types` (unique `name`) and `leave_balances` (unique `(employeeId, leaveTypeId)`) must be created by whatever process the project uses for the other entities; nothing in `services/api` defines one. The deploy owner should create them before the API version that reads them goes live. At least one `hr_admin` user must exist (role assignment is from the earlier access story).
  - **Order and rollback**: tables first, then API, then Web App (the pages tolerate a failing API through their error state). Rollback: redeploy the previous API/Web versions; the new tables are inert and can stay or be dropped.

  ### Verified against current code
  - Tokens and design-system classes are already loaded by `apps/web/src/index.css` (lines 1-2), so no Tailwind theme, `vite.config.ts` or token-import change is needed; screens use design-system classes plus a small `leave.css` like `records.css`.
  - A shell already exists (`RecordsLayout.tsx` with the six sections); it is reused instead of a new layout.
  - `GET /employees` is the existing HR-only name search (limit 50) and `GET /employees/options` returns all employees, so no new employee-list action or route is added.
  - An audit facility exists (`services/api/src/audit`, `AuditEntry`, written in the same transaction by `EmployeesService`), so ADR-0028 is followed in this story.
  - The prototype strings "Enter a whole number of days, 0 or more.", "<type> balance is now N days", "Save balance" and "Deletion refused. ..." were checked in the prototype's script.

  ### Design
  Approved prototype `TESTING-BROWN-17-STORY-019-design.html`: two screens (Leave types; Employee leave balances), each with default/loading/empty/error/forbidden states, three overlays (type modal, delete modal, balance modal) and a toast. Its inline classes (`.btn`, `.modal`, `.badge`, `.alert`, `.toast`, `.skeleton`, `.empty-state`, `.switch`) are defined in `design-system/prototype-utils.css`, which the app already imports; the prototype-only layout rules are redefined in `leave.css` on tokens. The prototype's contrast fixes (status text `--color-fg`, current nav link darker) are already how `records.css` styles `.alert`/`.badge`. No prototype/AC conflict found; the prototype's delete rule goes beyond the ACs (see open questions).

  ### Layering
  ```mermaid
  flowchart TD
    Web[LeaveTypesPage / LeaveBalancesPage] --> Layout[RecordsLayout]
    Web --> Client[leaveClient.ts]
    Web --> EmpClient[employeesClient getEmployeeOptions]
    Client -->|HTTP| LTC[LeaveTypesController]
    Client -->|HTTP| LBC[LeaveBalancesController]
    EmpClient -->|HTTP| EC[EmployeesController options]
    LTC --> Guards[SessionGuard, ReadOnlyGuard, PermissionGuard]
    LBC --> Guards
    Guards --> Can[permissions.ts can]
    LTC --> LTS[LeaveTypesService]
    LBC --> LBS[LeaveBalancesService]
    LTS --> DB[(leave_types, leave_balances, leave_entries, audit_entries)]
    LBS --> DB
    LM[leave.module.ts] --> LTC
    LM --> LBC
    classDef touched fill:#f96,color:#000
    class Web,Layout,Client,LTC,LBC,Can,LTS,LBS,LM touched
  ```
  Touched: `permissions.ts` (new `leave:manage`), `RecordsLayout` (active section and Admin link), `leave.module.ts` (registration), `AuditEntry` (action union); everything else marked is new. `EmployeesController`, `PermissionGuard`, `SessionGuard`, `ReadOnlyGuard` and `employeesClient.ts` are reused unchanged.

  ### First step for the builder
  Run the current suites once for a baseline: `(cd services/api && pnpm test) && (cd apps/web && pnpm run test)`. The API e2e suite needs PostgreSQL reachable through `DB_HOST`/`DB_NAME` (defaults in `app.module.ts`); confirm it runs locally before relying on it, and run `(cd apps/web && pnpm run typecheck)` after the web changes.
review_focus: |
  IN: leave-type CRUD with the exempt flag, hand-set per-employee balances (whole days, "not set" distinct from 0), HR-only mutations, audit rows for each change, and the two approved screens. OUT: accrual, carry-over, the request-time balance block, public holidays, the design's top bar. Riskiest: authorization (every write must hit `leave:manage`, including the executive via `ReadOnlyGuard`), the delete-refusal rule (balances plus the assumed `LeaveEntry.kind` link) and the balance upsert keeping AC4's independence. Deliberate: tokens and design-system classes are already loaded in `index.css`, so no Tailwind/Vite config change; the picker reuses `GET /employees/options`; no migrations exist in this repo (schema comes from `synchronize`), which is why Data and rollout flags production table creation.
