summary: |
  Add a self-service password reset to the existing sign-in/activation flow. A registered user requests a reset by email, receives a single-use, expiring token (hashed at rest, mirroring the activation token), and completes the reset with a new password. The API sets the new permanent password in Cognito (the identity provider that owns credentials), so the new password signs in and the previous one is refused by Cognito's own check. The web app gets a request page and a reset-completion page alongside the existing Sign in and Activate pages.
scope:
  - description: |
      API: new `PasswordResetToken` entity (table `password_reset_tokens`: id, userId, tokenHash unique, expiresAt, usedAt nullable), same shape as `ActivationToken`. Kept separate so an activation link can never be redeemed as a reset link or the reverse.
    files:
      - services/api/src/auth/entities/password-reset-token.entity.ts
    rationale: |
      A separate table keeps the two token purposes from being interchangeable.
  - description: |
      API: new `PasswordResetService`, modelled on `ActivationService` (hash, `Clock`, `DataSource.transaction` with a `pessimistic_write` row lock for single use).

      ```ts
      async request(email: string): Promise<void>            // never reveals whether the email is registered
      async redeem(token: string, password: string): Promise<void>
      ```

      `request` looks up an `active` user by trimmed, lowercased email. If one exists it stores a hashed token with TTL `PASSWORD_RESET_TOKEN_TTL_MS` and hands the raw token to a `PasswordResetNotifier` port. Otherwise it does nothing and returns normally. `redeem` locks the token row, rejects unknown, used or expired tokens, calls `cognito.setPermanentPassword(user.email, password)`, resets the lockout counters with `afterSuccess()`, and marks the token used, all in one transaction. A `PasswordPolicyError` from Cognito rolls back and leaves the token unused.
    files:
      - services/api/src/auth/password-reset.service.ts
      - services/api/src/auth/password-reset.notifier.ts
    rationale: |
      Reuses `CognitoAuthPort.setPermanentPassword`, so no port change is needed. The notifier port isolates email delivery (ADR-0010, Amazon SES), which does not exist in the codebase yet. The default binding is a logger that never logs the token.
  - description: |
      API: errors, constants, controller routes and module wiring.

      - `auth.errors.ts`: add `PasswordResetLinkInvalidError` and `PasswordResetLinkExpiredError`.
      - `auth.constants.ts`: add `PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000`, `PASSWORD_RESET_INVALID_MESSAGE` and `PASSWORD_RESET_EXPIRED_MESSAGE`.
      - `auth.controller.ts`: add `POST /auth/password-reset/request` (200, always `{ status: 'requested' }`, 200 on missing or malformed email too) and `POST /auth/password-reset/confirm` (200 `{ status: 'password_reset' }`; 410 expired, 400 `password_policy`, 400 invalid). This mirrors the existing `activate` handler.
      - `auth.module.ts`: register `PasswordResetService`, the notifier provider and `TypeOrmModule.forFeature([... PasswordResetToken])`.
    files:
      - services/api/src/auth/auth.errors.ts
      - services/api/src/auth/auth.constants.ts
      - services/api/src/auth/auth.controller.ts
      - services/api/src/auth/auth.module.ts
    rationale: |
      Follows the activation endpoint's error mapping so the web client can handle both the same way.
  - description: |
      Test support: add a stateful Cognito fake that keeps a password per email, so `signIn` really accepts only the current password and throws `InvalidCredentialsError` otherwise. The existing `fakeCognito()` jest mock cannot prove AC2 on its own.

      ```ts
      export function statefulCognito(initial: Record<string, string>): jest.Mocked<CognitoAuthPort>
      ```
    files:
      - services/api/src/auth/testing/fakes.ts
    rationale: |
      Needed to assert the old-password refusal at the AuthService level without a live Cognito.
  - description: |
      Web: add `requestPasswordReset(email)` and `resetPassword(token, password)` to `authClient.ts` (same `post` helper and result shape as `activate`). Add `ForgotPasswordPage` (email form, always shows a neutral confirmation) and `ResetPasswordPage` (new password form, mirrors `ActivatePage`, links back to sign in on success). Route `/forgot-password` and `/reset-password?token=` in `App.tsx` the same way `/activate` is routed, and add a "Forgot password?" link to `SignInPage`.
    files:
      - apps/web/src/auth/authClient.ts
      - apps/web/src/auth/ForgotPasswordPage.tsx
      - apps/web/src/auth/ResetPasswordPage.tsx
      - apps/web/src/auth/SignInPage.tsx
      - apps/web/src/App.tsx
    rationale: |
      Gives the user a way to carry out the story. Uses the Tailwind styling and pathname routing already in the app.
tests:
  - |
    AC1 (API, unit) in `services/api/src/auth/password-reset.service.spec.ts`: a reset sets the new password and the user can then sign in with it.

    ```ts
    await resets.request('a@example.com');
    const token = notifier.send.mock.calls[0][1];
    await resets.redeem(token, 'new-password-1');
    await expect(auth.signIn('a@example.com', 'new-password-1')).resolves.toMatchObject({ user: { email: 'a@example.com' } });
    expect(cognito.setPermanentPassword).toHaveBeenCalledWith('a@example.com', 'new-password-1');
    ```
  - |
    AC2 (API, unit), same spec: after the reset the previous password is refused.

    ```ts
    await resets.redeem(token, 'new-password-1');
    await expect(auth.signIn('a@example.com', 'old-password')).rejects.toBeInstanceOf(SignInRefusedError);
    ```
  - |
    Supporting service tests, same spec: a second redemption of the same token rejects with `PasswordResetLinkInvalidError`. An expired token (after `clock.advance`) rejects with `PasswordResetLinkExpiredError`. Two concurrent redemptions let exactly one through. A `PasswordPolicyError` leaves `usedAt` null. Only a hash is stored (`expect(tokens.rows[0].tokenHash).not.toContain(token)`). An unknown email does not throw and sends nothing (`expect(notifier.send).not.toHaveBeenCalled()`). A pending (not yet activated) user gets no token. A locked-out user can sign in with the new password after a reset.
  - |
    AC1 and AC2 (API, e2e, supertest) in `services/api/test/password-reset.e2e-spec.ts` using the same Cognito and notifier fakes: `POST /auth/password-reset/request` returns 200 for known and unknown emails, `POST /auth/password-reset/confirm` returns 200, then `POST /auth/sign-in` returns 200 with the new password and 401 with the old one. Check `services/api/test/jest-e2e.json` and the existing e2e setup before writing this; if there is none, cover the controller through a Nest testing module in `auth.controller.spec.ts`.
  - |
    Web (vitest) in `apps/web/src/auth/ResetPasswordPage.test.tsx` and `ForgotPasswordPage.test.tsx`, mirroring `ActivatePage.test.tsx`: submitting a new password calls `resetPassword(token, password)` and shows the sign-in link on success. A 410 or 400 response shows its message in a `role="alert"`. The forgot page shows the same neutral confirmation whatever the API returns. `SignInPage.test.tsx` gets `expect(screen.getByRole('link', { name: /forgot password/i })).toBeInTheDocument()`.
assumptions_or_open_questions:
  - |
    Email delivery. No mailer exists in the codebase (ADR-0010 names Amazon SES as the outbound integration, but nothing implements it), and `ActivationService.issue` is not wired to one either. This plan adds a `PasswordResetNotifier` port with a default implementation that logs only that a reset was issued, never the token. Until an SES-backed implementation is bound, a deployed environment cannot deliver reset links. Should SES delivery be part of this story, or a follow-up?
  - |
    Existing sessions are not revoked on reset, because no AC asks for it. A user who resets because the password leaked would normally want other sessions ended. This is a one-method addition (`SessionService.endAllForUser`) if the reviewer wants it.
  - |
    Only `active` users can reset. Pending users must use their activation link. Cognito's password policy is the only password rule, as in activation.
  - |
    Reset link TTL is 1 hour (`PASSWORD_RESET_TOKEN_TTL_MS`), shorter than the 24 hour activation link. The reviewer can change it. The request endpoint is not rate limited, which is the same as sign-in today.
  - |
    The reset link takes the form `/reset-password?token=...` on the web app origin. The notifier builds the URL from a base URL setting, which is only used by the real mailer.
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout

  - **Existing data**: a new table `password_reset_tokens` is added. No existing table or row changes, so existing users stay readable and able to sign in.
  - **Backfill / seed**: none needed.
  - **Settings**: none required. The TTL is a constant. A mailer base URL setting belongs to the follow-up SES work.
  - **Provisioning**: Cognito `AdminSetUserPassword` is already in use by activation, so no new IAM permission is needed. Outbound email needs SES provisioning, which is out of scope (see open questions).
  - **Order and rollback**: `app.module.ts` uses TypeORM `synchronize` outside production and I found no migration directory. Production must create the table, so check how the project applies schema there before release. The change is additive: rolling back the code leaves an unused empty table.

  ```mermaid
  flowchart TD
    classDef touched fill:#f96,color:#000
    Web[SignInPage / ForgotPasswordPage / ResetPasswordPage]:::touched --> Client[authClient.ts]:::touched
    Client --> Ctl[auth.controller.ts]:::touched
    Ctl --> PRS[password-reset.service.ts]:::touched
    PRS --> Tok[password-reset-token.entity.ts]:::touched
    PRS --> Port[cognito-auth.port.ts setPermanentPassword]
    PRS --> Notif[password-reset.notifier.ts]:::touched
    PRS --> Lock[lockout.policy.ts afterSuccess]
    Mod[auth.module.ts]:::touched --> PRS
    Ctl --> AS[auth.service.ts signIn]
    AS --> Port
  ```

  The service mirrors `ActivationService` (hash, single-use row lock, transactional Cognito call) so reviewers can compare the two directly.
review_focus: |
  IN scope: request and confirm endpoints, the token table and service, the notifier port, and the web pages. OUT of scope: a real SES mailer, session revocation, rate limiting. Riskiest area: `redeem` (single use under concurrency, rollback when Cognito rejects the password) and `request` leaking whether an email is registered. Deliberate choices: a separate token table from activation, Cognito as the source of truth for the old password being refused, and a notifier that never logs the token.
