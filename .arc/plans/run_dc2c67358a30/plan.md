summary: |
  Add role-based access for the four roles (employee, manager, HR admin, read-only executive). The API gets a single `role` on `User`, a pure permission policy (`can(actor, action, target)`), a guard that enforces it, and minimal read endpoints for own profile, another employee's record, own leave and dashboards. A manager sees only direct reports through the Employee Records reporting line (`managerId`). The read-only executive is refused every write. The web app learns the signed-in role from `/auth/session` and builds its navigation from a pure `navigationFor(role)` function, so the Admin section appears only for HR admins. The repo has no role, Employee Records, leave or dashboard code yet (only sign-in/activation from STORY-019), so this plan adds the thinnest seams the ACs need and nothing more.
scope:
  - description: |
      Role model. Add `export type Role = 'employee' | 'manager' | 'hr_admin' | 'read_only_executive'` and a `ROLES` array in `services/api/src/auth/role.ts`. Add `@Column({ type: 'varchar', default: 'employee' }) role!: Role;` to `User`. Extend `SessionGuard` so `req.user = { id, email, role }`, and have `GET /auth/session` return the role.
    files:
      - services/api/src/auth/role.ts
      - services/api/src/auth/entities/user.entity.ts
      - services/api/src/auth/session.guard.ts
      - services/api/src/auth/auth.controller.ts
    rationale: |
      One role per person is the story's premise. The default of `employee` is least privilege, so existing user rows keep working with no access gain.
  - description: |
      Pure permission policy in `services/api/src/access/permissions.ts`.

      ```ts
      export type Action = 'record:read' | 'record:write' | 'leave:read' | 'dashboards:read' | 'admin:view';
      export interface Actor { id: string; role: Role; employeeId: string | null }
      export interface RecordTarget { employeeId: string; managerEmployeeId: string | null }
      export function can(actor: Actor, action: Action, target?: RecordTarget): boolean;
      ```

      Rules:
      - record:read is allowed for the actor's own record, for a manager on a record whose `managerEmployeeId` equals the actor's `employeeId`, and for hr_admin on any record. Everyone else is refused, including the executive on other people's records.
      - record:write is refused for read_only_executive. Other roles are allowed per the rules above, with the manager limited to direct reports.
      - leave:read is allowed on own leave for every role.
      - dashboards:read is allowed for manager, hr_admin and read_only_executive.
      - admin:view is allowed for hr_admin only.
    files:
      - services/api/src/access/permissions.ts
      - services/api/src/access/permissions.spec.ts
    rationale: |
      Keeping the rules in one pure function makes AC1-12 unit-testable without HTTP. The guard, controllers and web navigation all derive from the same rules.
  - description: |
      Enforcement. `PermissionGuard` plus a `@RequirePermission(action)` decorator, used after `SessionGuard`. It loads the actor's Employee Records row and calls `can`. A refusal throws `ForbiddenException({ code: 'forbidden' })` with no record data in the body. The same module exports a `ReadOnlyGuard` that refuses any non-GET request from `read_only_executive`. Apply `ReadOnlyGuard` to every mutating route.
    files:
      - services/api/src/access/permission.guard.ts
      - services/api/src/access/require-permission.decorator.ts
      - services/api/src/access/access.module.ts
    rationale: |
      The refusal is enforced server side (AC6, AC9). Hiding navigation alone would not be enough.
  - description: |
      Minimal Employee Records read model and endpoints, in a new `employees` module. Entity `Employee { id, userId, displayName, managerId: string | null }`, where `managerId` is the reporting line. Routes, all behind `SessionGuard`:
      - `GET /employees/me` returns the caller's own profile.
      - `GET /employees/:id` is checked by the policy. A refused request returns 403 and never loads the record into the response.
      - `PATCH /employees/:id` is a write route that exists to enforce `ReadOnlyGuard` and `record:write`. It updates `displayName` only.
    files:
      - services/api/src/employees/employee.entity.ts
      - services/api/src/employees/employees.controller.ts
      - services/api/src/employees/employees.service.ts
      - services/api/src/employees/employees.module.ts
      - services/api/src/employees/employees.service.spec.ts
    rationale: |
      The AC wording "open a record" needs an endpoint to open. No Employee Records story code exists on this branch, so this is the smallest slice that carries the reporting line. If that story lands first, rebase onto its entity.
  - description: |
      Own leave and dashboards read endpoints. `GET /leave/me` returns the caller's own leave entries from a minimal `LeaveEntry { id, employeeId, startDate, endDate, kind }` entity. `GET /dashboards` is guarded by `dashboards:read` and returns a minimal read-only payload, `{ dashboards: [] }`. Wire `AccessModule`, `EmployeesModule` and `LeaveModule` into `AppModule`.
    files:
      - services/api/src/leave/leave-entry.entity.ts
      - services/api/src/leave/leave.controller.ts
      - services/api/src/leave/leave.module.ts
      - services/api/src/dashboards/dashboards.controller.ts
      - services/api/src/dashboards/dashboards.module.ts
      - services/api/src/app/app.module.ts
    rationale: |
      AC8 and AC12 need something to show. These are placeholders for the leave and dashboard stories, with no business logic.
  - description: |
      Web: role-aware session and navigation. `getSession()` returns `{ email, role }`. `AuthProvider` user type gains `role`. `navigationFor(role)` is pure and returns the permitted sections, and `Navigation` renders them in `Shell`.

      ```ts
      export type Section = 'profile' | 'leave' | 'team' | 'employees' | 'dashboards' | 'admin';
      export function navigationFor(role: Role): Section[];
      ```

      - employee: profile, leave
      - manager: profile, leave, team, dashboards
      - hr_admin: profile, leave, employees, dashboards, admin
      - read_only_executive: profile, leave, dashboards
    files:
      - apps/web/src/auth/authClient.ts
      - apps/web/src/auth/AuthProvider.tsx
      - apps/web/src/nav/navigation.ts
      - apps/web/src/nav/navigation.test.ts
      - apps/web/src/nav/Navigation.tsx
      - apps/web/src/nav/Navigation.test.tsx
      - apps/web/src/App.tsx
      - apps/web/src/App.test.tsx
    rationale: |
      AC10 and AC11. Navigation is a convenience layer only. The API is the real enforcement.
  - description: |
      API e2e coverage with supertest, in `services/api/test/access.e2e-spec.ts`, following the setup in `auth.e2e-spec.ts` (fake Cognito, real `AppModule`, sign in through `/auth/sign-in`). One Playwright check for the HR admin versus employee navigation, in `apps/web/e2e/access.spec.ts`.
    files:
      - services/api/test/access.e2e-spec.ts
      - apps/web/e2e/access.spec.ts
    rationale: |
      Proves that the guard really refuses over HTTP and that no record data leaks.
tests:
  - |
    AC1 (unit, permissions.spec.ts, fails first because `can` does not exist):
    `expect(can({ id: 'u1', role: 'employee', employeeId: 'e1' }, 'record:read', { employeeId: 'e1', managerEmployeeId: 'e9' })).toBe(true);`
    E2E: `await agent.get('/employees/me').expect(200)` and `expect(res.body.id).toBe(ownEmployee.id)`.
  - |
    AC2 (unit): `expect(can(employee, 'record:read', { employeeId: 'e2', managerEmployeeId: null })).toBe(false);`
    E2E: signed-in employee calls `GET /employees/<other>` and gets `403`. Assert `expect(res.body.displayName).toBeUndefined()`.
  - |
    AC3 (unit): `expect(can({ id: 'u2', role: 'manager', employeeId: 'm1' }, 'record:read', { employeeId: 'e1', managerEmployeeId: 'm1' })).toBe(true);`
    E2E: manager calls `GET /employees/<directReport>` and gets `200`.
  - |
    AC4 (unit): `expect(can(manager, 'record:read', { employeeId: 'e3', managerEmployeeId: 'someoneElse' })).toBe(false);`
    The same unit case also covers an indirect report, a report of a report, which is refused. E2E: manager calls `GET /employees/<nonReport>` and gets `403`.
  - |
    AC5 (unit): `expect(can(hrAdmin, 'record:read', anyTarget)).toBe(true);`
    E2E: HR admin calls `GET /employees/<any>` and gets `200`.
  - |
    AC6 (unit): `expect(can(executive, 'record:write', ownTarget)).toBe(false);`
    E2E: executive calls `PATCH /employees/<own id>` with `{ displayName: 'x' }` and gets `403`. Then assert the stored row is unchanged with `expect((await repo.findOneByOrFail({ id })).displayName).toBe(before)`.
  - |
    AC7 (unit, `it.each(['manager', 'hr_admin', 'read_only_executive'])`): `expect(can({ id, role, employeeId: 'e1' }, 'record:read', { employeeId: 'e1', managerEmployeeId: null })).toBe(true);`
    E2E: the same loop calls `GET /employees/me` and gets `200`.
  - |
    AC8 (E2E, `it.each` over the same three roles): seed one `LeaveEntry` for the caller. `GET /leave/me` returns `200` and `expect(res.body.entries).toHaveLength(1)`. The unit case is `expect(can(actor, 'leave:read', ownTarget)).toBe(true)`.
  - |
    AC9 (E2E): `const res = await agent.get('/employees/' + otherId).expect(403); expect(JSON.stringify(res.body)).not.toContain(other.displayName);`
    A second case with a non-existent id also returns `403`. It must not return `404`, so the response does not reveal whether the id exists.
  - |
    AC10 (web vitest, navigation.test.ts, `it.each(['employee', 'manager', 'read_only_executive'])`): `expect(navigationFor(role)).not.toContain('admin');`
    Component test: render `<Navigation role={role} />` and assert `expect(screen.queryByText('Admin')).toBeNull()`.
  - |
    AC11 (web vitest): `expect(navigationFor('hr_admin')).toContain('admin');`
    Component test: `expect(screen.getByText('Admin')).toBeInTheDocument()`. Playwright, with a mocked session as HR admin: the Admin link is visible.
  - |
    AC12 (E2E): executive calls `GET /dashboards` and gets `200`. An employee calling `GET /dashboards` gets `403` as a guard regression.
    Unit: `expect(can(executive, 'dashboards:read')).toBe(true);`
    Web: `expect(navigationFor('read_only_executive')).toContain('dashboards');`
  - |
    Regression: existing `auth.e2e-spec.ts` and the web auth tests still pass with `role` added to the session payload. A user row created with no role reads back as `employee`, which proves the default.
assumptions_or_open_questions:
  - |
    Employee Records, leave and dashboards do not exist on this branch. I assumed this story adds minimal read endpoints and entities as seams. Question for the reviewer: if those stories are in flight, should this plan instead depend on them and only add the policy and guard?
  - |
    The Employee to User link is modelled as `Employee.userId`. The actor's `employeeId` comes from that row. A user with no Employee row is treated as having `employeeId = null` and can read no records.
  - |
    A refused record request returns 403 for both existing and non-existent ids, so existence is not leaked. The ACs say only "refused" and "not shown".
  - |
    Dashboards access for manager and hr_admin is my assumption. The ACs only name the executive. Employees are refused.
  - |
    How a person is given the manager, HR admin or executive role is out of scope. It belongs to the user and role administration story. Until then roles are set directly in the database, and the e2e tests set the role when they create users.
  - |
    ReadOnlyGuard covers routes that opt in. Sign-in, sign-out and activation are not guarded because they change no business data. Question for the reviewer: should the guard be global instead, with an allowlist for the auth routes?
  - |
    Audit log viewing is explicitly delivered by the audit log story, so the audit route is not added here, and `admin:view` only governs the Admin navigation section.
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout

  - **Existing data**: this adds `users.role` (varchar, default `'employee'`) and two new tables (`employees`, `leave_entries`). Existing user rows get `employee` on the new column, which is the least-privileged role, so nothing is locked out and nobody gains access. A user with no Employee row can still sign in and see the empty self-service views.
  - **Backfill / seed**: no data backfill is needed. At least one HR admin must be seeded by hand, with an idempotent SQL `UPDATE users SET role = 'hr_admin' WHERE email = '<admin email>'`, until the user and role administration story exists. This is safe to re-run.
  - **Settings**: none. No new env vars.
  - **Provisioning**: an HR admin user plus Employee rows linking users to the reporting line. The Employee Records data must supply `managerId`.
  - **Order and rollback**: `app.module.ts` uses `synchronize` outside production, and no migrations directory exists in the repo. Production schema changes therefore need a migration created by the project's normal process before deploy. Deploy the schema first, then the code. To roll back, drop the column and the tables. The code that reads `role` is the only dependent, so leaving the column in place is also safe.

  Test for existing rows: create a `User` through the repository without `role` and assert it reads back as `employee`, and that `GET /employees/me` for such a user returns 403 or an empty profile rather than throwing.

  The work item text contained no instructions beyond the change itself.

  ```mermaid
  flowchart TD
    SessionGuard[auth/session.guard.ts]
    UserEntity[auth/entities/user.entity.ts]
    AuthController[auth/auth.controller.ts]
    Perm[access/permissions.ts]
    PGuard[access/permission.guard.ts]
    EmpCtl[employees/employees.controller.ts]
    LeaveCtl[leave/leave.controller.ts]
    DashCtl[dashboards/dashboards.controller.ts]
    AppModule[app/app.module.ts]
    AuthClient[web auth/authClient.ts]
    AuthProv[web auth/AuthProvider.tsx]
    Nav[web nav/navigation.ts]
    AppTsx[web App.tsx]
    SessionGuard -->|adds role to req.user| PGuard
    UserEntity -->|role column| SessionGuard
    AuthController -->|session returns role| AuthClient
    PGuard -->|calls can| Perm
    EmpCtl -->|RequirePermission| PGuard
    LeaveCtl -->|own leave only| PGuard
    DashCtl -->|dashboards:read| PGuard
    AppModule -->|imports new modules| EmpCtl
    AuthClient --> AuthProv
    AuthProv -->|role| AppTsx
    Nav -->|sections by role| AppTsx
    classDef touched fill:#f96,color:#000
    class SessionGuard,UserEntity,AuthController,Perm,PGuard,EmpCtl,LeaveCtl,DashCtl,AppModule,AuthClient,AuthProv,Nav,AppTsx touched
  ```
review_focus: |
  IN scope: the role column, the pure policy, the guards, minimal employee, leave and dashboard read endpoints, and role-based navigation. OUT of scope: role assignment UI, user admin, audit log viewing, and any real leave or dashboard logic. The riskiest part is the manager direct-report check and refusals that leak record data or existence, so check that 403 is returned for unknown ids and that no record is loaded into a refused response. The `employee` default for existing users is deliberate least privilege, and the web navigation is only a convenience layer over the API enforcement.
