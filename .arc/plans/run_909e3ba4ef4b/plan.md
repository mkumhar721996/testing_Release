summary: |
  Add HR-admin user and role administration. API (comp_api_service): a new `users-admin` module exposing
  `GET /admin/users`, `POST /admin/users/invite`, `PATCH /admin/users/:id/role`, `POST /admin/users/:id/deactivate`
  and `POST /admin/users/:id/reactivate`, all behind SessionGuard + ReadOnlyGuard + PermissionGuard with the existing
  `admin:view` action (HR admin only). Deactivation sets `User.status = 'deactivated'`, ends every live session
  immediately and disables the Cognito user; sign-in already refuses any non-`active` status. SessionGuard is hardened to
  reject non-active users so a session can never outlive deactivation. Web app (comp_web_app): an Admin "Users" page that builds
  the approved prototype (user list in a card, invite modal, single-choice role drawer, deactivate confirm modal, search,
  loading / empty / access-restricted states), plus a one-time load of the design tokens.
scope:
  - description: |
      Role is stored as one scalar column already (`User.role`), so "one role only" is structural. Extend
      `UserStatus` from `'pending' | 'active'` to `'pending' | 'active' | 'deactivated'` (varchar column, no DB enum, so no
      schema change). Export a `ROLE_LABELS` helper only if the API needs it; labels live in the web app.
    files:
      - services/api/src/auth/entities/user.entity.ts
    rationale: |
      Smallest change that lets the list show Deactivated. AuthService.signIn already refuses `status !== 'active'`
      (auth.service.ts line 35), which covers AC10 once the status exists; a test pins it.
  - description: |
      Enforce deactivation on live sessions (AC9). In SessionGuard, after loading the user, refuse unless
      `user.status === 'active'` (same 401 `session_expired`). Add to SessionService
      `endAllForUser(userId: string): Promise<Session[]>` that sets `endedAt = clock.now()` on every session of the user with
      `endedAt` null, returning them (refresh tokens decrypted) so the caller can revoke them in Cognito.
    files:
      - services/api/src/auth/session.guard.ts
      - services/api/src/auth/session.service.ts
    rationale: |
      SessionGuard reads `user.role` and the user row from the database on every request, so role changes already take
      effect on the next request and deactivation does too. That answers the deferred question on how quickly role
      changes reach active sessions: immediately, with no token claims to refresh.
  - description: |
      Extend CognitoAuthPort with `createUser(email: string): Promise<{ sub: string }>` (AdminCreateUser,
      MessageAction SUPPRESS, so the platform delivers the activation link, not Cognito; user left unconfirmed/disabled
      until activation calls `enableUser`) and `disableUser(email: string): Promise<void>` (AdminDisableUser).
      `enableUser` already exists and is reused for reactivation. Implement both in AwsCognitoAuth; add the
      two jest.fn() entries to `fakeCognito()`. Add an `ActivationNotifier` (interface + token
      `ACTIVATION_NOTIFIER` + Logging placeholder that never logs the token) mirroring password-reset.notifier.ts, registered in AuthModule and
      exported with ActivationService.
    files:
      - services/api/src/auth/cognito-auth.port.ts
      - services/api/src/auth/aws-cognito-auth.ts
      - services/api/src/auth/activation.notifier.ts
      - services/api/src/auth/auth.module.ts
      - services/api/src/auth/testing/fakes.ts
    rationale: |
      Nothing today creates a user or sends an activation link (ActivationService.issue has no caller). Invite needs
      both. Activation itself stays with the sign-in story; invite only issues the token via the existing `issue()`.
  - description: |
      New UsersAdminModule: `UsersAdminService` and `UsersAdminController` (`@Controller('admin/users')`,
      `@UseGuards(SessionGuard, ReadOnlyGuard, PermissionGuard)`, every handler `@RequirePermission('admin:view')`).
      Signatures:

      ```ts
      list(): Promise<AdminUserView[]>   // { id, email, displayName | null, role, status }
      invite(input: { email: string; displayName: string; role: Role }): Promise<AdminUserView>
      changeRole(userId: string, role: Role): Promise<AdminUserView>
      deactivate(userId: string): Promise<AdminUserView>
      reactivate(userId: string): Promise<AdminUserView>
      ```

      Rules: `role` must be one string in `ROLES` (a missing, array or unknown value gives 400 `role_required` / `role_invalid`, nothing created or sent);
      invite normalises email (trim, lower-case), rejects a duplicate with 409 `email_taken`, calls `cognito.createUser`,
      saves User (`status: 'pending'`, chosen role, `cognitoSub`), creates the Employee row with `displayName`
      (Employee.userId is unique, employee.entity.ts), issues the activation token and calls the notifier; deactivate only from `active`,
      then saves `status: 'deactivated'`, `sessions.endAllForUser`, best-effort `cognito.signOut(refreshToken)` per ended
      session, `cognito.disableUser`; reactivate only from `deactivated`, `cognito.enableUser`, `status: 'active'`
      and clears lockout. Wrong-state transitions give 409 `invalid_state`. The unknown target id gives 404. Register in AppModule imports.
      Edge cases explicitly out of scope per the item (self role removal, last HR admin).
    files:
      - services/api/src/users-admin/users-admin.module.ts
      - services/api/src/users-admin/users-admin.service.ts
      - services/api/src/users-admin/users-admin.controller.ts
      - services/api/src/app/app.module.ts
    rationale: |
      Follows the EmployeesController pattern (guards plus RequirePermission). `admin:view` already exists in
      permissions.ts and is HR-admin only, and ReadOnlyGuard blocks the executive's writes, so AC8 on the API needs no new
      policy. The DB write comes before the Cognito calls so a Cognito outage cannot leave an active account that
      should be deactivated; the Cognito calls are idempotent, so a retry is safe.
  - description: |
      Web client and page. `adminUsersClient.ts` exports `listUsers`, `inviteUser`, `changeRole`, `deactivateUser`,
      `reactivateUser` (fetch with `credentials: "include"`, same style as shopClient.ts / authClient.ts).
      `UsersAdminPage.tsx` implements the prototype's "User list" screen: `h1` "Users" with the single `.btn-primary`
      "Invite user"; search input (filters name or email, `role="status"` count "N users"); a bordered list of rows each
      with avatar initials, name, email, role badge, status badge (Active = success with check icon, Deactivated = danger with x icon,
      Pending = warning), and "Change role" (secondary) plus "Deactivate"/"Reactivate" (ghost) buttons that carry
      `aria-label`s such as "Deactivate Priya Shah"; skeleton rows while loading; the "No users match this search." empty state
      with "Clear search". `InviteUserModal.tsx`: Full name, Work email, Role `select` with a "Select a role" placeholder
      and the four roles; inline `role="alert"` "Choose a role to send the invitation." and `aria-disabled` Send invitation until name, email and role are present
      (AC11); "Sending…" pending label. `ChangeRoleDrawer.tsx`: a `fieldset` with a `legend` "Role" and exactly four radios
      (name="role", current role preselected) with each role's one-line note from the prototype; "Save role" primary.
      `DeactivateModal.tsx`: `role="alertdialog"` with the text "<name> will be signed out at once and cannot sign in until the account is reactivated.";
      "Deactivate" primary. Reactivate is immediate. Toasts on completion (design copy: "<name> reactivated. They can sign in again.", "<name> is now <role>.", "<name> deactivated. Their session has ended.", "Invitation sent to <name> as <role>.").
      `AccessRestricted.tsx`: "This page is available to HR admins only." card (AC8 UI).
      Routing: App.tsx renders `UsersAdminPage` at pathname `/admin/users` for hr_admin and the restricted card for any other role, without calling the API. Add the
      "Users" admin link to the signed-in view; Navigation already lists Admin only for hr_admin.
    files:
      - apps/web/src/admin/adminUsersClient.ts
      - apps/web/src/admin/UsersAdminPage.tsx
      - apps/web/src/admin/InviteUserModal.tsx
      - apps/web/src/admin/ChangeRoleDrawer.tsx
      - apps/web/src/admin/DeactivateModal.tsx
      - apps/web/src/admin/AccessRestricted.tsx
      - apps/web/src/App.tsx
    rationale: |
      Builds the approved prototype's five screens. Below 768px the rows collapse to stacked cards (prototype media query) and the dialogs use
      the `.modal`/`.drawer` conventions from UI-GUIDELINES. `.btn-primary` is used once per screen (Invite on the list; Send / Save role / Deactivate in their own overlays).
  - description: |
      Load design tokens once. The web app does not load them today: apps/web/src/index.css holds only the three
      `@tailwind` directives, main.tsx imports index.css, and tailwind.config.ts has an empty `theme.extend` (all read this
      session; a grep for "tokens" and "design-system" in apps/web excluding node_modules found nothing). Add
      `@import "../../../design-system/tokens.css";` at the top of index.css and map tokens in `theme.extend` of
      tailwind.config.ts to `var(--…)` keys (colors, spacing, radius, fontSize, fontFamily, boxShadow). Components use only these
      keys. Tokens used: --color-bg, --color-bg-subtle, --color-bg-inset, --color-fg, --color-fg-muted, --color-fg-inverse,
      --color-primary, --color-primary-hover, --color-primary-subtle, --color-border, --color-border-strong, --color-success(-subtle),
      --color-warning(-subtle), --color-danger(-subtle), --color-overlay, --space-1…--space-6, --radius-sm/md/lg/full,
      --font-size-xs/sm/md/lg/xl, --font-weight-medium/semibold, --shadow-sm/md.
    files:
      - apps/web/src/index.css
      - apps/web/tailwind.config.ts
    rationale: |
      UI-GUIDELINES requires token-only styling with no colour literals or raw pixel values that a token covers. The prototype's fixed
      sizes (drawer 420px, modal 480px, 44px touch target, 36px switch) have no token and go in the open questions.
tests:
  - |
    AC1 (write first, fails: module does not exist). users-admin.service.spec.ts and test/users-admin.e2e-spec.ts (supertest).
    As an HR admin session, GET /admin/users lists every user.
    ```ts
    const res = await agent.get('/admin/users').expect(200);
    expect(res.body.map((u: { email: string }) => u.email)).toEqual(expect.arrayContaining(['a@x.com', 'b@x.com']));
    ```
  - |
    AC2. POST /admin/users/invite with a role creates a pending user who appears in the list, with an activation token issued and the notifier called once.
    ```ts
    await agent.post('/admin/users/invite').send({ email: 'New@X.com', displayName: 'New Joiner', role: 'manager' }).expect(201);
    const list = (await agent.get('/admin/users')).body;
    expect(list.find((u) => u.email === 'new@x.com')).toMatchObject({ role: 'manager', status: 'pending' });
    expect(cognito.createUser).toHaveBeenCalledWith('new@x.com');
    expect(notifier.notify).toHaveBeenCalledTimes(1);
    ```
  - |
    AC3. The role options are exactly four. API side pins ROLES, web side counts the radios in ChangeRoleDrawer.test.tsx
    and the options in InviteUserModal.test.tsx.
    ```ts
    expect(ROLES).toEqual(['employee', 'manager', 'hr_admin', 'read_only_executive']);
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(['employee','manager','hr_admin','read_only_executive']);
    ```
  - |
    AC4. PATCH role replaces the role, and the list shows only the new one. A web test (UsersAdminPage.test.tsx) saves a new role in the drawer and asserts the row's badge.
    ```ts
    await agent.patch(`/admin/users/${id}/role`).send({ role: 'hr_admin' }).expect(200);
    expect((await agent.get('/admin/users')).body.find((u) => u.id === id).role).toBe('hr_admin');
    // web: expect(within(row).getByText('HR admin')).toBeInTheDocument(); expect(within(row).queryByText('Employee')).toBeNull();
    ```
  - |
    AC5. One role only. The API rejects an array or a missing role and the drawer renders radios, not checkboxes.
    ```ts
    await agent.patch(`/admin/users/${id}/role`).send({ role: ['manager', 'employee'] }).expect(400);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    await user.click(screen.getByRole('radio', { name: /manager/i }));
    expect(screen.getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)).toHaveLength(1);
    ```
  - |
    AC6. Deactivating an active account shows Deactivated in the list.
    ```ts
    await agent.post(`/admin/users/${id}/deactivate`).expect(201);
    expect((await agent.get('/admin/users')).body.find((u) => u.id === id).status).toBe('deactivated');
    ```
  - |
    AC7. Reactivating a deactivated account shows Active again, and Cognito enableUser is called.
    ```ts
    await agent.post(`/admin/users/${id}/reactivate`).expect(201);
    expect(statusOf(id)).toBe('active');
    expect(cognito.enableUser).toHaveBeenCalledWith('b@x.com');
    ```
  - |
    AC8. Employee, manager and read-only executive get 403 on every admin route and no data. The web test shows the restricted card and does not call the API.
    ```ts
    for (const role of ['employee', 'manager', 'read_only_executive']) {
      await signedInAs(role).get('/admin/users').expect(403);
      await signedInAs(role).post('/admin/users/invite').send(validInvite).expect(403);
    }
    // web: render(<App/>) as manager at /admin/users
    expect(screen.getByText('This page is available to HR admins only.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    ```
  - |
    AC9. A signed-in user's next request fails 401 right after deactivation, their sessions are ended and the Cognito refresh token is revoked
    (session.service.spec.ts for endAllForUser, e2e for the flow).
    ```ts
    await userAgent.get('/auth/session').expect(200);
    await adminAgent.post(`/admin/users/${id}/deactivate`).expect(201);
    await userAgent.get('/auth/session').expect(401);
    expect(cognito.signOut).toHaveBeenCalledWith('refresh-token');
    expect(cognito.disableUser).toHaveBeenCalledWith('b@x.com');
    ```
  - |
    AC10. A deactivated account signing in with valid credentials is refused, and Cognito is not consulted (auth.service.spec.ts).
    ```ts
    await expect(auth.signIn('b@x.com', 'right-password')).rejects.toBeInstanceOf(SignInRefusedError);
    expect(cognito.signIn).not.toHaveBeenCalled();
    ```
  - |
    AC11. Inviting without a role is rejected and nothing is created or sent. The web test shows the inline error and a send that does nothing.
    ```ts
    await agent.post('/admin/users/invite').send({ email: 'n@x.com', displayName: 'N' }).expect(400);
    expect(cognito.createUser).not.toHaveBeenCalled();
    expect(notifier.notify).not.toHaveBeenCalled();
    // web: expect(screen.getByRole('alert')).toHaveTextContent('Choose a role to send the invitation.');
    // await user.click(screen.getByRole('button', { name: 'Send invitation' })); expect(inviteUser).not.toHaveBeenCalled();
    ```
  - |
    Regression and data. Existing rows with `status` 'pending' or 'active' still list, sign in and resolve a session after the change
    (SessionGuard now requires 'active', so a pending user's session cannot exist; a test pins that active users are unaffected).
    ```ts
    expect(await guard.canActivate(ctxFor(activeUser))).toBe(true);
    await expect(guard.canActivate(ctxFor({ ...activeUser, status: 'deactivated' }))).rejects.toBeInstanceOf(UnauthorizedException);
    ```
assumptions_or_open_questions:
  - |
    Prototype vs. sign-in story. The prototype's invite pushes the joiner as Active with an immediate "Invitation sent" toast.
    The sign-in and activation story keeps new users `pending` until they follow the activation link, and AuthService.signIn refuses any non-active user.
    The plan shows an invited joiner as a "Pending" badge (warning) and does NOT add them as Active. This departs from the prototype's badge on that one row; AC2 only requires the joiner and the selected role to appear. Please confirm.
  - |
    Cognito identity mapping (deferred question). The plan treats `users.email` (unique, lower-cased) as the join key to the Cognito username and stores `cognitoSub` returned by createUser. Role never lives in Cognito, it is read from the `users` row on every request. Please confirm that no Cognito group or custom claim should carry the role.
  - |
    The activation email transport does not exist (password reset uses a logging placeholder). The plan adds the same kind of placeholder ActivationNotifier. Real delivery (the SES integration, ADR-0010) is not in this item. Until it exists the activation link is not actually emailed.
  - |
    Prototype sizes with no token (drawer 420px, modal 480px, 44px touch targets, 36px minimum row action height, 1040px page max width) are not covered by tokens. They need a decision (tokens, or Tailwind arbitrary values) before implementation. The plan does not add pixel literals.
  - |
    The prototype shows a user "Search" and a count; search is done client-side over the loaded list (no API search, no pagination). Fine for current volumes; revisit if the user count grows.
  - |
    Project-wide retention and backup/recovery questions (CHORE-014) are not answered here. Deactivation keeps the user row and its employee record (no deletion), which is compatible with any retention answer. Note that no audit log entry is written by this item, since the audit log is another story in the epic. The state-changing admin actions here are the natural events for it to record later.
  - |
    Edge cases are out of scope as the item states: an HR admin changing their own role or deactivating themselves, and removing the last HR admin. Nothing blocks them yet.
  - |
    Unknown whether the `users` table is managed by migrations. No migrations folder turned up under services/api/src, and AppModule uses `synchronize` outside production. If production uses a different mechanism, the status value needs no DDL because the column is a plain varchar.
estimated_points: 8
package_dependencies: []
notes: |
  ### Data & rollout

  - **Existing data**: `users.status` is a plain `varchar`, so the new `'deactivated'` value needs no migration and existing 'pending' / 'active' rows are untouched and keep working. No new columns. The employee row created on invite uses the existing Employee entity.
  - **Backfill / seed**: none. No existing row needs changing.
  - **Settings**: no new env var. Cognito calls reuse COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID and AWS_REGION already read by AwsCognitoAuth.
  - **Provisioning**: the API's AWS role needs the Cognito permissions `cognito-idp:AdminCreateUser` and `cognito-idp:AdminDisableUser`, alongside the existing AdminEnableUser, AdminSetUserPassword and AdminGetUser. Please confirm who owns that IAM change.
  - **Order and rollback**: deploy the API first, then the web app. Rolling back the API leaves any 'deactivated' rows in place. Old code treats them as not active (sign-in refuses them), which is safe. The web app is safe to roll back on its own.

  ### How it fits

  SessionGuard reloads the user on every request, so role changes and deactivation take effect on the next request. The web app's Navigation is a convenience layer only; the API enforces access.

  Design tokens: the web app does not load design-system/tokens.css today (index.css has only the tailwind directives, tailwind.config.ts has an empty `theme.extend`). The scope item for index.css and tailwind.config.ts adds the import once and maps tokens to Tailwind keys.

  ```mermaid
  flowchart TD
    UAC[UsersAdminController]:::touched --> SG[SessionGuard]:::touched
    UAC --> PG[PermissionGuard]
    PG --> CAN[permissions.can admin:view]
    UAC --> UAS[UsersAdminService]:::touched
    UAS --> ACT[ActivationService.issue]
    UAS --> SS[SessionService.endAllForUser]:::touched
    UAS --> COG[CognitoAuthPort createUser disableUser]:::touched
    UAS --> NOT[ActivationNotifier]:::touched
    UAS --> UE[User entity status deactivated]:::touched
    AS[AuthService.signIn]:::ctx --> UE
    APP[AppModule]:::touched --> UAC
    WEB[UsersAdminPage]:::touched --> CL[adminUsersClient]:::touched
    CL --> UAC
    APPX[App.tsx routing]:::touched --> WEB
    classDef touched fill:#f96,color:#000
    classDef ctx fill:#ddd,color:#000
  ```

  Why touched: SessionGuard (rejects non-active users), SessionService (end all sessions), CognitoAuthPort (create and disable), ActivationNotifier (new delivery seam), User entity (new status), UsersAdmin* (new API surface), AppModule (registration), the web admin page, its client and App.tsx (routing, role gate).

  Test files follow the repo patterns: jest `*.spec.ts` beside the service using `FakeRepo`, `FakeDataSource` and `fakeCognito()` from services/api/src/auth/testing/fakes.ts, supertest e2e in services/api/test/*.e2e-spec.ts (access.e2e-spec.ts is the model for per-role 403 checks), and vitest plus Testing Library in apps/web/src/admin/*.test.tsx. Narrow commands: `(cd services/api && pnpm test -- users-admin)` and `(cd apps/web && pnpm run test -- src/admin)`.
review_focus: |
  IN: the five HR-admin API endpoints, deactivation ending sessions at once (SessionGuard plus SessionService.endAllForUser), and the web Users page with its invite modal, role drawer and deactivate confirm, built from the approved prototype. OUT: self-role removal and last-HR-admin protection, real email delivery, audit log entries, API pagination. Riskiest part is deactivation ordering and the Cognito calls (DB first, best-effort revoke, idempotent retry) and the invite flow (Cognito user, User row, Employee row and token must not leave a half-created account on failure). Deliberate: invited joiners show as Pending, not Active as in the prototype, because sign-in refuses non-active accounts until activation.
