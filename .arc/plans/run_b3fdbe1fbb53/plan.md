summary: |
  Add forgot-password / reset-password to the API Service auth module and Web App. A registered, active user requests a reset by email; the API issues a single-use, expiring, hashed reset token (mirroring the existing activation-token flow) and hands the link to a notifier port. The user then submits the token plus a new password; the API sets it as the permanent Cognito password, marks the token used, and clears any sign-in lockout, after which the existing sign-in works with the new password. The Web App gets a request page and a reset page.
scope:
  - description: |
      Add the PasswordResetToken entity (table password_reset_tokens), same shape as ActivationToken:
      id uuid, userId uuid, tokenHash unique, expiresAt timestamptz, usedAt timestamptz nullable.
      Register it in AuthModule's TypeOrmModule.forFeature.
    files:
      - services/api/src/auth/entities/password-reset-token.entity.ts
      - services/api/src/auth/auth.module.ts
    rationale: |
      Separate table from activation_tokens so the two link types cannot be redeemed against each other.
  - description: |
      Add PasswordResetService with
      `request(email: string): Promise<void>` and
      `redeem(token: string, password: string): Promise<void>`.
      request(): lowercases/trims email, looks up the user; only for status active it issues a token
      (sha256 hash stored, 32 random bytes hex, TTL constant PASSWORD_RESET_TOKEN_TTL_MS = 1h) and calls the
      PasswordResetNotifier port. Unknown or non-active users do nothing and never throw, so the outcome is not observable.
      redeem(): in a dataSource.transaction, pessimistic_write lock on the token row; invalid/used -> PasswordResetLinkInvalidError;
      expired -> PasswordResetLinkExpiredError; then cognito.setPermanentPassword(user.email, password)
      (PasswordPolicyError propagates and rolls back leaving the link unused), update the user with the afterSuccess() lockout reset, and set usedAt.
      Does NOT call enableUser, so a reset cannot activate a pending account.
    files:
      - services/api/src/auth/password-reset.service.ts
      - services/api/src/auth/password-reset.notifier.ts
      - services/api/src/auth/auth.errors.ts
      - services/api/src/auth/auth.constants.ts
    rationale: |
      Mirrors ActivationService (row lock for single use, Cognito before commit, idempotent Cognito call makes retry safe).
      The notifier port (`PASSWORD_RESET_NOTIFIER`, `notify(email, token, expiresAt)`) keeps email delivery behind an interface, as COGNITO_AUTH does for Cognito.
  - description: |
      Add POST /auth/password-reset/request (always 202 with a generic body for any email, 202 also for malformed input)
      and POST /auth/password-reset/confirm (body token, password; 200 { status: 'password_reset' };
      410 password_reset_link_expired, 400 password_reset_link_invalid, 400 password_policy), following the activate handler's error mapping.
      Wire PasswordResetService and a default notifier provider into AuthModule.
    files:
      - services/api/src/auth/auth.controller.ts
      - services/api/src/auth/auth.module.ts
    rationale: Same controller-level error-to-HTTP mapping as activate.
  - description: |
      Test support: add `jest.Mocked`-style fake notifier helper `fakeNotifier()` to fakes.ts.
      No change to CognitoAuthPort: setPermanentPassword already does what a reset needs.
    files:
      - services/api/src/auth/testing/fakes.ts
    rationale: Unit and e2e tests need to capture the issued token, which is otherwise only sent out of band.
  - description: |
      Web App: add authClient functions
      `requestPasswordReset(email): Promise<void>` and
      `resetPassword(token, password): Promise<ActivateResult>`,
      a ForgotPasswordPage (email form, generic confirmation), a ResetPasswordPage (new password form, mirrors ActivatePage, link back to sign in on success),
      route /reset-password?token=... and /forgot-password in App.tsx, and a "Forgot password?" link on SignInPage.
    files:
      - apps/web/src/auth/authClient.ts
      - apps/web/src/auth/ForgotPasswordPage.tsx
      - apps/web/src/auth/ResetPasswordPage.tsx
      - apps/web/src/auth/SignInPage.tsx
      - apps/web/src/App.tsx
    rationale: AC is user-facing; pages follow the pathname routing already used for /activate.
tests:
  - |
    AC1 (API unit, write first, services/api/src/auth/password-reset.service.spec.ts, uses FakeRepo/FakeDataSource/fakeCognito):
    ```ts
    const user = await activeUser('a@example.com');
    await reset.request('A@Example.com ');
    const { token } = notifier.notify.mock.calls[0][0]; // or positional args
    await reset.redeem(token, 'new-password');
    expect(cognito.setPermanentPassword).toHaveBeenCalledWith('a@example.com', 'new-password');
    expect(tokens.rows[0].usedAt).not.toBeNull();
    ```
  - |
    AC1 (API e2e, services/api/test/auth.e2e-spec.ts): full flow, then sign in with the new password.
    ```ts
    await request(app.getHttpServer()).post('/auth/password-reset/request').send({ email: user.email }).expect(202);
    const token = notifier.lastToken();
    await request(app.getHttpServer()).post('/auth/password-reset/confirm').send({ token, password: 'new-password' }).expect(200, { status: 'password_reset' });
    cognito.signIn.mockImplementation(async (_e, p) => { if (p !== 'new-password') throw new InvalidCredentialsError(); return { refreshToken: 'r', sub: 'sub' }; });
    await signIn(user.email, 'new-password').expect(200);
    await signIn(user.email, 'old-password').expect(401);
    ```
  - |
    Supporting unit tests (same spec): stores only a hash (`expect(tokens.rows[0].tokenHash).not.toContain(token)`); second redemption rejects with PasswordResetLinkInvalidError; expired (clock advanced 1h+1ms) rejects with PasswordResetLinkExpiredError and setPermanentPassword not called; PasswordPolicyError leaves usedAt null and the link reusable; concurrent redemption lets one through (`expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)`); unknown/pending email issues no token and does not throw (`expect(notifier.notify).not.toHaveBeenCalled()`); a locked account (failedSignInCount 5, lockStartedAt set) is unlocked after reset.
  - |
    Controller e2e: request returns identical 202 bodies for a registered and an unregistered email; confirm returns 410 with code password_reset_link_expired after clock.advance(60 * 60_000 + 1), 400 password_policy for a weak password.
  - |
    Web (vitest, ForgotPasswordPage.test.tsx / ResetPasswordPage.test.tsx / SignInPage.test.tsx / App.test.tsx): submitting the forgot form calls `requestPasswordReset` with the email and shows the generic confirmation; submitting the reset form calls `resetPassword(token, password)` and then shows `getByRole('link', { name: /sign in/i })`; a failure shows the server message in `getByRole('alert')`; /reset-password?token=abc renders ResetPasswordPage with token abc; SignInPage has a "Forgot password?" link to /forgot-password.
assumptions_or_open_questions:
  - |
    No outbound email exists in the codebase yet (ActivationService.issue only returns the token; ADR-0010 names Amazon SES as the intended integration). I assumed actual delivery is out of scope: this plan adds a PASSWORD_RESET_NOTIFIER port with a default provider that only logs that a reset was requested (never the token). Until an SES-backed notifier exists, real users cannot receive the link. Please confirm that is acceptable, or that SES delivery should be added here (which would add a package_dependency on @aws-sdk/client-sesv2 for comp_api_service and a verified sender setting).
  - Reset links expire after 1 hour (activation links use 24 hours); the reviewer can change PASSWORD_RESET_TOKEN_TTL_MS.
  - Only active accounts can reset; pending accounts must use the activation flow, and the request response is identical either way to avoid account enumeration.
  - Rate limiting of the request endpoint and revoking existing sessions on reset are not in the AC and are left out.
  - Password strength is enforced by the Cognito pool policy, as for activation, not duplicated in the API.
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout

  - **Existing data**: adds one new table, password_reset_tokens; no existing table or row changes, so all existing users and sessions are untouched.
  - **Backfill / seed**: none needed.
  - **Settings**: none required. PASSWORD_RESET_TOKEN_TTL_MS is a code constant, safe by default. A future SES notifier would add sender settings to services/api/.env.example.
  - **Provisioning**: nothing before the API works; the Cognito app client must keep admin password set permission, already needed for activation. Email delivery needs the SES integration (see open questions).
  - **Order and rollback**: schema is created by TypeORM synchronize outside production; services/api has no migrations directory and production sets synchronize false, so the table must be created through whatever production schema process exists (to confirm) BEFORE deploying the new code. Rollback: the new table and endpoints are additive and safe to leave in place; dropping the table is optional.

  ```mermaid
  flowchart TD
    Web[SignInPage / ForgotPasswordPage / ResetPasswordPage]:::touched --> Client[authClient.ts]:::touched
    Client --> Ctl[AuthController]:::touched
    Ctl --> PRS[PasswordResetService]:::touched
    PRS --> Ent[PasswordResetToken entity]:::touched
    PRS --> Port[CognitoAuthPort.setPermanentPassword]
    PRS --> Notif[PasswordResetNotifier port]:::touched
    PRS --> Lock[lockout.policy afterSuccess]
    Port --> AWS[AwsCognitoAuth]
    Mod[AuthModule]:::touched --> PRS
    classDef touched fill:#f96,color:#000
  ```

  Mirrors ActivationService: hashed single-use token, row lock, Cognito call inside the transaction.
review_focus: |
  IN scope: API request/confirm endpoints, token entity/service, notifier port, and the web request/reset pages. OUT: real email delivery (SES), rate limiting, session revocation. Riskiest area is PasswordResetService.redeem (single-use under concurrency, Cognito call ordering, not activating pending users) and the non-enumerating request endpoint. The 1h TTL and the log-only default notifier are deliberate placeholders pending reviewer input.
