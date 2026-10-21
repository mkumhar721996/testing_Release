summary: |
  Add sign-in, sign-out, failed-sign-in handling, 30-minute inactivity timeout and email-link account activation. The API (NestJS, comp_api_service) mediates every sign-in. It calls Cognito through a thin port, `CognitoAuthPort`, and owns the Postgres state Cognito cannot give us exactly: the user's activation status, one-time activation tokens, the 5-failures / 15-minute lock, and server-side sessions with a `last_activity_at` timestamp. The SPA (React/Vite, comp_web_app) gets a sign-in page, an activation page and a sign-out control that talk to those endpoints. The repo is currently a bare scaffold (health endpoint and a placeholder `App`), so this plan also creates the minimal `User`, `ActivationToken` and `Session` entities. Later stories (role-based screens, user admin, import, HR invite) extend them. Everything is built test-first, with time-dependent rules driven by an injectable `Clock`.
scope:
  - description: |
      Auth persistence. Create three TypeORM entities, picked up by the existing `autoLoadEntities: true`:
      - `User`: `id` (uuid), `email` (unique, lowercased), `cognitoSub`, `status` ('pending' | 'active'), `failedSignInCount` (int, default 0), `lockStartedAt` (nullable timestamptz).
      - `ActivationToken`: `id`, `userId`, `tokenHash` (sha256 hex, unique), `expiresAt`, `usedAt` (nullable).
      - `Session`: `id` (opaque random id), `userId`, `cognitoRefreshToken`, `createdAt`, `lastActivityAt`, `endedAt` (nullable).
      The user entity is deliberately minimal. The role columns belong to the role-based-permissions story.
    files:
      - services/api/src/auth/entities/user.entity.ts
      - services/api/src/auth/entities/activation-token.entity.ts
      - services/api/src/auth/entities/session.entity.ts
    rationale: |
      No schema exists yet and the API owns the relational schema. The lock counter and the activation tokens must be durable and shared across API instances, so in-memory state is not an option.
  - description: |
      Injectable clock and shared constants so every time rule is testable without sleeping.
      ```ts
      export abstract class Clock { abstract now(): Date; }
      export class SystemClock extends Clock { now() { return new Date(); } }
      export const MAX_FAILED_ATTEMPTS = 5;
      export const LOCK_DURATION_MS = 15 * 60 * 1000;
      export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
      ```
    files:
      - services/api/src/auth/clock.ts
      - services/api/src/auth/auth.constants.ts
    rationale: |
      ACs 5, 11-14 depend on exact time boundaries (29:59 vs 30:00, 14:59 vs 15:00). A fake clock makes those assertions deterministic.
  - description: |
      Lockout policy as a pure, unit-testable module with no I/O.
      ```ts
      export interface LockState { failedSignInCount: number; lockStartedAt: Date | null }
      export function isLocked(state: LockState, now: Date): boolean;
      export function afterFailure(state: LockState, now: Date): LockState;
      export function afterSuccess(): LockState; // { failedSignInCount: 0, lockStartedAt: null }
      ```
      Rules:
      - `afterFailure` increments the count, and sets `lockStartedAt = now` when the count reaches 5.
      - `isLocked` is true while `now < lockStartedAt + 15 min`.
      - A lock that has expired is treated as a fresh state (count 0) before the next attempt is evaluated.
    files:
      - services/api/src/auth/lockout.policy.ts
      - services/api/src/auth/lockout.policy.spec.ts
    rationale: |
      Cognito's built-in temporary lockout is progressive and not configurable to "5 failures then exactly 15 minutes". Meeting ACs 11-14 therefore means enforcing the rule ourselves, and a pure module keeps the boundary logic trivial to test.
  - description: |
      Cognito port plus the AWS implementation. The port is the only place the AWS SDK is touched, so tests substitute a fake.
      ```ts
      export interface CognitoAuthPort {
        signIn(email: string, password: string): Promise<{ refreshToken: string; sub: string }>; // throws InvalidCredentialsError
        signOut(refreshToken: string): Promise<void>;
        setPermanentPassword(email: string, password: string): Promise<void>;
        enableUser(email: string): Promise<void>;
      }
      export const COGNITO_AUTH = Symbol('COGNITO_AUTH');
      ```
      `AwsCognitoAuth` uses `InitiateAuthCommand` with `USER_PASSWORD_AUTH`, `RevokeTokenCommand` for sign-out, and `AdminSetUserPasswordCommand` and `AdminEnableUserCommand` for activation. If Cognito ever returns a `ChallengeName`, it is treated as a failure, so a second factor can never be requested (AC 8). Pool id, client id and region come from env via `ConfigService`.
    files:
      - services/api/src/auth/cognito-auth.port.ts
      - services/api/src/auth/aws-cognito-auth.ts
    rationale: |
      The ACs are written against Cognito but must be verifiable offline. Everything below the port is real code, and the port is faked in unit and e2e tests.
  - description: |
      `ActivationService`.
      ```ts
      issue(userId: string): Promise<{ token: string; expiresAt: Date }>; // called by the import / HR-invite stories
      redeem(token: string, password: string): Promise<void>; // throws ActivationLinkExpiredError | ActivationLinkInvalidError
      ```
      - `issue` stores only the sha256 of a 32-byte random token and sets a 24h expiry.
      - `redeem` hashes the presented token, rejects unknown or already-used tokens, and rejects expired ones. Otherwise it sets the Cognito password, enables the user, sets `users.status = 'active'` and stamps `usedAt`, all in one transaction.
      - It works the same for imported staff and HR-invited joiners, because both are just `pending` users with a token.
    files:
      - services/api/src/auth/activation.service.ts
      - services/api/src/auth/activation.service.spec.ts
    rationale: |
      Covers ACs 1, 2, 9 and 10. The import and HR-invite stories only need to call `issue()` and send the link. Storing a hash means a database leak does not yield usable links.
  - description: |
      `AuthService` (sign-in orchestration) and `SessionService`.
      ```ts
      signIn(email: string, password: string): Promise<{ sessionId: string; user: { id: string; email: string } }>; // throws SignInRefusedError
      signOut(sessionId: string): Promise<void>;
      // SessionService
      create(userId: string, refreshToken: string): Promise<Session>;
      touchIfActive(sessionId: string): Promise<Session | null>; // null when ended or idle >= 30 min
      end(sessionId: string): Promise<void>;
      ```
      Sign-in flow:
      1. Normalise the email and load the user.
      2. If the user is missing or not `active`, throw `SignInRefusedError`. No counter is touched, since there is no account to count against.
      3. If `isLocked(...)`, throw `SignInRefusedError` WITHOUT calling Cognito, so a correct password during the lock window is still refused.
      4. Call `cognito.signIn`.
      5. On failure, persist `afterFailure` and throw `SignInRefusedError`.
      6. On success, persist `afterSuccess` and create the session.
      Every refusal path throws the same error type, which maps to one generic message (AC 7).
    files:
      - services/api/src/auth/auth.service.ts
      - services/api/src/auth/auth.service.spec.ts
      - services/api/src/auth/session.service.ts
      - services/api/src/auth/session.service.spec.ts
    rationale: |
      Covers ACs 3, 4, 5, 6, 8 and 11-14. Keeping refusal reasons indistinguishable at the service boundary guarantees the HTTP layer cannot leak account details by accident.
  - description: |
      HTTP layer: `AuthController`, `SessionGuard` and `AuthModule`.
      - `POST /auth/sign-in` takes `{ email, password }` and sets an httpOnly, SameSite=Lax, `Secure` (non-dev) cookie `sid`. It returns 200 `{ status: 'signed_in', user }`, with no challenge field. Any refusal is 401 `{ message: 'Incorrect email or password.' }`.
      - `POST /auth/sign-out` ends the session, revokes the Cognito refresh token, clears the cookie and returns 204.
      - `GET /auth/session` is guarded and returns the current user, which lets the SPA probe the session.
      - `POST /auth/activate` takes `{ token, password }` and returns 200 `{ status: 'activated' }`. An expired link is 410 `{ code: 'activation_link_expired', message: 'This activation link has expired. Request a new activation email.' }`. An unknown or used link is 400 with a generic message.
      - `SessionGuard` reads the `sid` cookie and calls `touchIfActive`. A null result gives 401 `{ code: 'session_expired' }`, and the guard is exported for the later role-based-screens story.
      - `main.ts` gains cookie parsing. `AppModule` imports `AuthModule`.
    files:
      - services/api/src/auth/auth.controller.ts
      - services/api/src/auth/session.guard.ts
      - services/api/src/auth/auth.module.ts
      - services/api/src/app/app.module.ts
      - services/api/src/main.ts
      - services/api/package.json
    rationale: |
      Wires the services to HTTP and enforces the inactivity timeout on every protected request ("when they next make a request", AC 5). The `package.json` change adds the AWS SDK Cognito client and `cookie-parser`.
  - description: |
      API end-to-end tests (supertest) against the real `AppModule` and Postgres, the same pattern as the existing `test/app.e2e-spec.ts`. They override `COGNITO_AUTH` with a fake and `Clock` with a controllable clock. One test per AC where the behaviour crosses HTTP.
    files:
      - services/api/test/auth.e2e-spec.ts
    rationale: |
      Proves the cookie, status codes and message bodies, which the unit tests do not cover.
  - description: |
      Web: auth client, session context, sign-in page, activation page and sign-out.
      ```ts
      // apps/web/src/auth/authClient.ts
      export type SignInResult = { ok: true } | { ok: false; message: string };
      export function signIn(email: string, password: string): Promise<SignInResult>;
      export function signOut(): Promise<void>;
      export function activate(token: string, password: string): Promise<{ ok: true } | { ok: false; code: string; message: string }>;
      export function getSession(): Promise<{ email: string } | null>;
      ```
      - Requests use `credentials: 'include'` against `import.meta.env.VITE_API_BASE_URL`.
      - `AuthProvider` loads the session on mount and exposes `user`, `signIn` and `signOut`. Any 401 from the API clears the user, which returns the app to the sign-in page (AC 5).
      - `App.tsx` renders `ActivatePage` at `/activate?token=...`. Otherwise it renders `SignInPage` when signed out, or a minimal signed-in shell with a "Sign out" button. Role-based screens are out of scope.
      - The sign-in page shows the server's generic message verbatim and never adds anything of its own about the account. The activation page shows the server's expiry message.
      - Routing is by `window.location.pathname`, so no router dependency is added. The existing `App.test.tsx` "Web App" heading assertion is updated, because the signed-out view now shows the sign-in form.
    files:
      - apps/web/src/auth/authClient.ts
      - apps/web/src/auth/AuthProvider.tsx
      - apps/web/src/auth/SignInPage.tsx
      - apps/web/src/auth/ActivatePage.tsx
      - apps/web/src/auth/SignInPage.test.tsx
      - apps/web/src/auth/ActivatePage.test.tsx
      - apps/web/src/auth/AuthProvider.test.tsx
      - apps/web/src/App.tsx
      - apps/web/src/App.test.tsx
      - apps/web/e2e/auth.spec.ts
    rationale: |
      Makes ACs 1-10 reachable by a person. Playwright is the confirmed E2E tool for this component, so `e2e/auth.spec.ts` runs the flow in a browser with the API stubbed via `page.route`.
tests:
  - |
    AC1, activate an imported staff member (`activation.service.spec.ts`). Write first, expect it to fail with "ActivationService is not defined".
    ```ts
    const { token } = await activation.issue(importedStaff.id); // importedStaff.status === 'pending'
    await activation.redeem(token, 'Str0ng-Passw0rd!');
    expect((await users.findOneByOrFail({ id: importedStaff.id })).status).toBe('active');
    expect(cognito.setPermanentPassword).toHaveBeenCalledWith(importedStaff.email, 'Str0ng-Passw0rd!');
    ```
    The e2e version posts the token to the endpoint with `await request(app.getHttpServer()).post('/auth/activate').send({ token, password }).expect(200)`.
  - |
    AC2, activate an HR-invited joiner. The same flow with a `pending` user created through the invite path (a fixture user with `source: 'hr_invite'`, no code differences). It asserts that both sources end `active` and that the token's `usedAt` is set.
    ```ts
    await activation.redeem(token, 'Str0ng-Passw0rd!');
    expect((await tokens.findOneByOrFail({ userId: invitee.id })).usedAt).not.toBeNull();
    expect((await users.findOneByOrFail({ id: invitee.id })).status).toBe('active');
    ```
    A second `redeem` of the same token must reject with `ActivationLinkInvalidError`, because the AC says "unused".
  - |
    AC3, valid credentials sign the user in (`auth.service.spec.ts`, and e2e).
    ```ts
    cognito.signIn.mockResolvedValue({ refreshToken: 'r', sub: user.cognitoSub });
    const res = await auth.signIn(user.email, 'right-password');
    expect(res.user.email).toBe(user.email);
    expect(await sessions.touchIfActive(res.sessionId)).not.toBeNull();
    ```
    e2e: `.post('/auth/sign-in').send(creds).expect(200)` and `expect(res.headers['set-cookie'][0]).toMatch(/^sid=.*HttpOnly/)`.
  - |
    AC4, sign-out ends the session (e2e).
    ```ts
    await agent.post('/auth/sign-out').expect(204);
    await agent.get('/auth/session').expect(401);
    expect(cognito.signOut).toHaveBeenCalledWith('r');
    ```
  - |
    AC5, 30 minutes inactive (`session.service.spec.ts` and e2e), with a fake clock.
    ```ts
    clock.set(t0); const s = await sessions.create(user.id, 'r');
    clock.set(t0 + 29 * 60_000 + 59_000);
    expect(await sessions.touchIfActive(s.id)).not.toBeNull(); // activity resets the timer
    clock.set(clock.now().getTime() + 30 * 60_000);
    expect(await sessions.touchIfActive(s.id)).toBeNull();
    ```
    e2e: after advancing the clock 30 minutes, `agent.get('/auth/session').expect(401)` with body `code: 'session_expired'`. Because the user then has no session, they must sign in again.
  - |
    AC6, wrong password is refused (`auth.service.spec.ts`).
    ```ts
    cognito.signIn.mockRejectedValue(new InvalidCredentialsError());
    await expect(auth.signIn(user.email, 'wrong')).rejects.toBeInstanceOf(SignInRefusedError);
    expect((await users.findOneByOrFail({ id: user.id })).failedSignInCount).toBe(1);
    ```
    e2e: `.post('/auth/sign-in').send({ email, password: 'wrong' }).expect(401)` and `expect(res.headers['set-cookie']).toBeUndefined()`.
  - |
    AC7, the refusal reveals no account details (e2e). The response body must be identical across the four cases: wrong password, unknown email, not-yet-activated account, and locked account.
    ```ts
    const bodies = await Promise.all([wrongPw, unknownEmail, pendingUser, lockedUser].map(r => r.then(x => x.body)));
    for (const b of bodies) expect(b).toEqual({ message: 'Incorrect email or password.' });
    ```
    The web test also asserts `screen.getByRole('alert')` has exactly that text and that the entered email is not echoed.
  - |
    AC8, no second factor (`auth.service.spec.ts`, `aws-cognito-auth` unit test, e2e).
    ```ts
    expect(res.body).toEqual({ status: 'signed_in', user: { id: expect.any(String), email: user.email } });
    expect(res.body).not.toHaveProperty('challenge');
    ```
    The `AwsCognitoAuth` unit test feeds a mocked SDK response containing `ChallengeName: 'SMS_MFA'` and expects `signIn` to throw rather than return tokens, so the app can never reach an MFA step.
  - |
    AC9, expired link is refused (`activation.service.spec.ts` and e2e).
    ```ts
    const { token } = await activation.issue(user.id);
    clock.set(clock.now().getTime() + 24 * 60 * 60_000 + 1);
    await expect(activation.redeem(token, 'Str0ng-Passw0rd!')).rejects.toBeInstanceOf(ActivationLinkExpiredError);
    expect((await users.findOneByOrFail({ id: user.id })).status).toBe('pending');
    expect(cognito.enableUser).not.toHaveBeenCalled();
    ```
    e2e: `.expect(410)`.
  - |
    AC10, the expired-link message asks for a new email (e2e and `ActivatePage.test.tsx`).
    ```ts
    expect(res.body.message).toBe('This activation link has expired. Request a new activation email.');
    ```
    ```tsx
    activateMock.mockResolvedValue({ ok: false, code: 'activation_link_expired', message: EXPIRED_MSG });
    render(<ActivatePage token="t" />);
    await user.type(screen.getByLabelText(/password/i), 'Str0ng-Passw0rd!');
    await user.click(screen.getByRole('button', { name: /activate/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/request a new activation email/i);
    ```
  - |
    AC11, 4 consecutive failures, then the correct password succeeds (`auth.service.spec.ts` and `lockout.policy.spec.ts`).
    ```ts
    for (let i = 0; i < 4; i++) await expect(auth.signIn(user.email, 'bad')).rejects.toThrow(SignInRefusedError);
    cognito.signIn.mockResolvedValue({ refreshToken: 'r', sub: user.cognitoSub });
    await expect(auth.signIn(user.email, 'right')).resolves.toBeDefined();
    expect((await users.findOneByOrFail({ id: user.id })).failedSignInCount).toBe(0);
    ```
  - |
    AC12, 5 consecutive failures, then the correct password is refused (`auth.service.spec.ts`).
    ```ts
    for (let i = 0; i < 5; i++) await expect(auth.signIn(user.email, 'bad')).rejects.toThrow(SignInRefusedError);
    cognito.signIn.mockResolvedValue({ refreshToken: 'r', sub: user.cognitoSub });
    await expect(auth.signIn(user.email, 'right')).rejects.toBeInstanceOf(SignInRefusedError);
    ```
    The lockout policy unit test adds `expect(afterFailure({ failedSignInCount: 4, lockStartedAt: null }, now).lockStartedAt).toEqual(now)`.
  - |
    AC13, correct password less than 15 minutes after the lock began is refused (`auth.service.spec.ts`).
    ```ts
    // lock begins at t0 on the 5th failure
    clock.set(t0 + 15 * 60_000 - 1);
    await expect(auth.signIn(user.email, 'right')).rejects.toBeInstanceOf(SignInRefusedError);
    expect(cognito.signIn).not.toHaveBeenCalledWith(user.email, 'right'); // refused before reaching Cognito
    ```
  - |
    AC14, correct password exactly 15 minutes after the lock began succeeds (`auth.service.spec.ts` and `lockout.policy.spec.ts`).
    ```ts
    clock.set(t0 + 15 * 60_000);
    cognito.signIn.mockResolvedValue({ refreshToken: 'r', sub: user.cognitoSub });
    await expect(auth.signIn(user.email, 'right')).resolves.toBeDefined();
    const u = await users.findOneByOrFail({ id: user.id });
    expect(u.lockStartedAt).toBeNull();
    ```
    Policy test: `expect(isLocked({ failedSignInCount: 5, lockStartedAt: t0 }, new Date(t0.getTime() + 900_000))).toBe(false)`.
assumptions_or_open_questions:
  - |
    Activation sets the password. The story says only "account is activated" and does not say how the initial password is chosen. I assumed the activation link opens a page that collects a password, and the API sets it permanently in Cognito (`AdminSetUserPasswordCommand` with `Permanent: true`) while enabling the user. If provisioning is meant to set credentials another way, `setPermanentPassword` and the password field come out and nothing else changes. Please confirm.
  - |
    Sending the activation email, and requesting a new one, are out of scope. AC10 only requires the expired-link message to ask for a new email. `ActivationService.issue()` returns the token, and the import and HR-invite stories are assumed to own the email delivery (SES or similar) and the "request a new email" endpoint. Say if this story must also deliver the email.
  - |
    Activation link lifetime is 24 hours. The story says only "expired", so this value is my choice. It is a single constant that is easy to change.
  - |
    Failed-attempt rules are my reading of the ACs. The count is of consecutive failures and resets on any success. Failures are only counted for accounts that exist and are activated. A lock that has expired starts a fresh count. An attempt made while locked does not extend the lock, which keeps AC 14 exact.
  - |
    Locked, unknown and not-yet-activated accounts get the same generic message as a wrong password. That is the only way to satisfy AC 7 without revealing which accounts exist or which are locked. The cost is that a locked user is not told why they are refused.
  - |
    Cognito's own lockout is progressive and cannot be set to 5 failures and 15 minutes. I assume the API is the enforcement point, with `USER_PASSWORD_AUTH` enabled on the app client. Cognito's temporary lockout can still fire underneath ours after repeated bad attempts. That adds delay but never makes a refused attempt succeed.
  - |
    Infrastructure is not in this repo. The user pool must have MFA set to OFF (AC 8), the app client must allow `ALLOW_USER_PASSWORD_AUTH` and `ALLOW_REFRESH_TOKEN_AUTH`, and the API role needs `cognito-idp:AdminSetUserPassword`, `AdminEnableUser`, `InitiateAuth` and `RevokeToken`. The code only reads the new env vars `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID` and `AWS_REGION`.
  - |
    The inactivity timeout is enforced server-side using `Session.lastActivityAt`, not by Cognito token expiry. Each guarded request refreshes the timestamp ("sliding" window). The web app shows no countdown or warning, since no AC asks for one.
  - |
    API e2e tests need a reachable Postgres, as the existing `app.e2e-spec.ts` already does (`TypeOrmModule` with `synchronize` outside production). No new test infrastructure is assumed.
estimated_points: 8
package_dependencies:
  - name: "@aws-sdk/client-cognito-identity-provider"
    version: "^3.700.0"
    ecosystem: npm
    component_id: comp_api_service
    rationale: |
      Provides the `CognitoIdentityProviderClient` and the `InitiateAuth`, `RevokeToken`, `AdminSetUserPassword` and `AdminEnableUser` commands used by `AwsCognitoAuth`. Nothing in the API depends on the AWS SDK today.
  - name: cookie-parser
    version: "^1.4.7"
    ecosystem: npm
    component_id: comp_api_service
    rationale: |
      Reads the httpOnly `sid` session cookie in `SessionGuard`. The express platform adapter does not parse cookies on its own.
  - name: "@types/cookie-parser"
    version: "^1.4.8"
    ecosystem: npm
    component_id: comp_api_service
    rationale: |
      Type definitions for `cookie-parser` (TypeScript strict build for the API).
  - name: "@testing-library/user-event"
    version: "^14.5.2"
    ecosystem: npm
    component_id: comp_web_app
    rationale: |
      The `SignInPage` and `ActivatePage` vitest tests type into fields and click buttons. `@testing-library/react` is installed, but `user-event` is not.
notes: |
  The repo is a scaffold. The only existing API code is `AppController` (health), `AppModule` (TypeORM, autoLoadEntities) and `main.ts`. On the web side, the only existing code is a placeholder `App.tsx` and its test, plus `playwright.config.ts` and `e2e/app.spec.ts`. The worker (`comp_worker`) is untouched, because no AC needs a queue.

  Design choice: the browser never talks to Cognito directly. Sign-in goes through the API, because the 5-failures / 15-minute rule and the 30-minute inactivity rule have to be enforced exactly and centrally. Cognito's own lockout and token lifetimes can't be tuned to those values. The cost is that the API handles raw passwords in transit (over TLS, never logged or stored).

  ```mermaid
  flowchart TD
    classDef touched fill:#f96,color:#000
    classDef newfile fill:#9cf,color:#000
    Web[apps/web App.tsx]:::touched -->|sign-in, sign-out, activate, session| AuthCtl[auth.controller.ts new]:::newfile
    Main[main.ts]:::touched -->|add cookie parsing| AppMod[app.module.ts]:::touched
    AppMod -->|imports AuthModule| AuthMod[auth.module.ts new]:::newfile
    AuthMod --> AuthCtl
    AuthCtl --> AuthSvc[auth.service.ts new]:::newfile
    AuthCtl --> ActSvc[activation.service.ts new]:::newfile
    AuthCtl --> Guard[session.guard.ts new]:::newfile
    Guard --> SessSvc[session.service.ts new]:::newfile
    AuthSvc --> Policy[lockout.policy.ts new]:::newfile
    AuthSvc --> Cog[aws-cognito-auth.ts new]:::newfile
    ActSvc --> Cog
    AuthSvc --> DB[(Postgres via TypeORM)]
    ActSvc --> DB
    SessSvc --> DB
    Cog --> Cognito[(AWS Cognito)]
  ```
  Orange nodes are existing files that change. Blue nodes are new files. The grey stores are untouched context.

  Suggested TDD order: lockout policy, session service, auth service (ACs 3, 6, 11-14), activation service (ACs 1, 2, 9, 10), controller and e2e (ACs 4, 5, 7, 8), then the web pages and the Playwright spec.
review_focus: |
  IN scope: API sign-in, sign-out, session and inactivity timeout, activation redemption, and the lockout rule, plus the matching SPA sign-in and activation pages. OUT of scope: sending activation emails, requesting a new link, role-based screens and permissions, user import and HR invite, and any MFA. The riskiest area is the lockout and session time boundaries: the 5th failure starts the lock, the lock lifts at exactly 15:00, and a session expires at exactly 30:00 idle. Please check those boundaries and that a locked account is refused before Cognito is called. Two decisions are deliberate: every refusal returns the same generic message (AC 7), and sign-in is proxied through the API instead of calling Cognito from the browser, because Cognito's lockout cannot be tuned to the required rule.
