summary: |
  Let a visitor with no account register from the shopping flow. The web app gets a "Register" link on the page a signed-out visitor lands on (the sign-in form, which is what /shop renders for a visitor) that opens a new /register page with an email + password form (AC1). Submitting posts to a new API endpoint POST /auth/register, which creates the Cognito user and the matching users row, so an account exists (AC2). Follows the existing auth module pattern (CognitoAuthPort + service + controller + fakes) and the existing web pattern (authClient + page component + vitest).
scope:
  - description: |
      API: add `createUser` to the Cognito port and its AWS implementation, plus two errors and a message constant.
      ```ts
      // cognito-auth.port.ts
      /** Creates a confirmed user with a permanent password. Throws EmailAlreadyRegisteredError / PasswordPolicyError. */
      createUser(email: string, password: string): Promise<{ sub: string }>;
      ```
      AwsCognitoAuth.createUser sends AdminCreateUserCommand (MessageAction SUPPRESS, email_verified true), then AdminSetUserPasswordCommand with Permanent true. UsernameExistsException maps to EmailAlreadyRegisteredError, InvalidPasswordException to PasswordPolicyError (if the password step fails, best-effort AdminDeleteUserCommand so no orphan Cognito user is left). Sub is read from the AdminCreateUser response attributes.
    files:
      - services/api/src/auth/cognito-auth.port.ts
      - services/api/src/auth/aws-cognito-auth.ts
      - services/api/src/auth/auth.errors.ts
      - services/api/src/auth/auth.constants.ts
      - services/api/src/auth/testing/fakes.ts
    rationale: |
      Registration needs the identity provider (Cognito, per ADR-0007) to own the credentials, exactly as sign-in and activation do. fakeCognito() gains a createUser jest.fn so existing specs keep compiling.
  - description: |
      API: new RegistrationService and POST /auth/register.
      ```ts
      // registration.service.ts
      async register(email: string, password: string): Promise<{ id: string; email: string }>
      ```
      Normalises email (trim, lower-case), rejects an existing users row with EmailAlreadyRegisteredError, calls cognito.createUser, saves a User with status 'active', cognitoSub from Cognito, failedSignInCount 0, lockStartedAt null. Controller route is `@Post('register') @HttpCode(201)`; body not strings or empty maps to 400 code registration_invalid; PasswordPolicyError maps to 400 password_policy (existing message); EmailAlreadyRegisteredError maps to 409 code email_already_registered. Wire the provider in AuthModule.
    files:
      - services/api/src/auth/registration.service.ts
      - services/api/src/auth/auth.controller.ts
      - services/api/src/auth/auth.module.ts
    rationale: |
      Mirrors ActivationService and the controller's try/catch-to-HTTP-exception pattern. New accounts are created active because registration here has no email-verification step in scope; sign-in (AuthService) only admits status 'active' users.
  - description: |
      Web: add `register` to authClient, a RegisterPage component, a "Register" link on SignInPage, and a /register route in App.
      ```ts
      export type RegisterResult = { ok: true } | { ok: false; code: string; message: string };
      export async function register(email: string, password: string): Promise<RegisterResult>
      ```
      RegisterPage has Email and Password inputs (both required), heading "Register", a "Register" submit button, an alert for errors, and on success a status message "Account created" with a link to sign in. App renders RegisterPage at /register before the AuthProvider branch, like /forgot-password.
    files:
      - apps/web/src/auth/authClient.ts
      - apps/web/src/auth/RegisterPage.tsx
      - apps/web/src/auth/SignInPage.tsx
      - apps/web/src/App.tsx
    rationale: |
      A signed-out visitor to /shop sees SignInPage (Shell gates on user), so the Register link there is the visitor's entry point. Follows the ForgotPasswordPage and ResetPasswordPage structure and Tailwind styling.
tests:
  - |
    AC1 (web), SignInPage.test.tsx, written first and failing:
    ```tsx
    it("links to the registration page", () => {
      render(<SignInPage />);
      expect(screen.getByRole("link", { name: /register/i })).toHaveAttribute("href", "/register");
    });
    ```
    AC1 (web), App.test.tsx:
    ```tsx
    it("shows the registration form at /register", () => {
      window.history.pushState({}, "", "/register");
      render(<App />);
      expect(screen.getByRole("heading", { name: "Register" })).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toHaveAttribute("type", "password");
    });
    ```
  - |
    AC2 (web), new RegisterPage.test.tsx, with vi.mock("./authClient"):
    ```tsx
    vi.mocked(client.register).mockResolvedValue({ ok: true });
    render(<RegisterPage />);
    await userEvent.type(screen.getByLabelText(/email/i), "new@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "test-password");
    await userEvent.click(screen.getByRole("button", { name: "Register" }));
    expect(client.register).toHaveBeenCalledWith("new@example.com", "test-password");
    expect(await screen.findByRole("status")).toHaveTextContent("Account created");
    ```
    Plus: a failed result renders `role="alert"` with the server message; submitting with the password empty does not call register.
  - |
    AC2 (API), new registration.service.spec.ts using FakeRepo<User> and fakeCognito():
    ```ts
    cognito.createUser.mockResolvedValue({ sub: 'sub-1' });
    await registration.register('  New@Example.com ', 'test-password');
    expect(cognito.createUser).toHaveBeenCalledWith('new@example.com', 'test-password');
    expect(users.rows).toHaveLength(1);
    expect(users.rows[0]).toMatchObject({ email: 'new@example.com', cognitoSub: 'sub-1', status: 'active' });
    ```
    Plus: an existing email rejects with EmailAlreadyRegisteredError and never calls cognito.createUser; a PasswordPolicyError from Cognito propagates and saves no row.
  - |
    AC2 (API adapter), extend aws-cognito-auth.spec.ts in its existing mocking style:
    ```ts
    // UsernameExistsException from AdminCreateUser
    await expect(auth.createUser('a@example.com', 'pw')).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
    // InvalidPasswordException from AdminSetUserPassword
    await expect(auth.createUser('a@example.com', 'pw')).rejects.toBeInstanceOf(PasswordPolicyError);
    ```
  - |
    AC2 (HTTP mapping), controller test (supertest, as the stack specifies) against AuthController with RegistrationService stubbed:
    ```ts
    await request(app.getHttpServer()).post('/auth/register').send({ email: 'a@example.com', password: 'test-password' }).expect(201);
    await request(app.getHttpServer()).post('/auth/register').send({ email: 'a@example.com' }).expect(400);
    ```
    Duplicate email returns 409 with code email_already_registered.
assumptions_or_open_questions:
  - |
    The shopping page at /shop is only rendered for signed-in users today, so "a visitor on the shopping page" is read as the signed-out view, which is the sign-in page. The Register link goes there. If the intent is a public, browsable shopping page with its own Register control, that is a larger change and should be raised.
  - |
    No email-verification or activation step is in the ACs, so a registered account is created with status 'active' and can sign in immediately. If verification is wanted, registration should create a 'pending' user and issue an ActivationService token instead.
  - |
    The password policy is whatever the Cognito user pool enforces (surfaced as password_policy), and the form has no extra fields (no name or phone), because the ACs say only "all required details" and the existing users table holds only email and credentials.
  - |
    Registration does not sign the visitor in; after "Account created" they use the existing sign-in form.
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout

  None — no schema change: the existing `users` table and User entity are reused as they are. No new env vars or settings (COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID and AWS_REGION already exist). The one provisioning point is that the API's IAM role must be allowed `cognito-idp:AdminCreateUser` and `cognito-idp:AdminDeleteUser` besides the Admin calls it already makes (AdminSetUserPassword, AdminEnableUser, AdminGetUser). Deploy order is not constrained, since the web link only works once the API route exists, so ship the API first. Rollback is to revert the code; users created in the meantime stay valid.

  ```mermaid
  flowchart TD
    SignIn[SignInPage.tsx: add Register link]:::touched --> App[App.tsx: /register route]:::touched
    App --> Reg[RegisterPage.tsx: new form]:::touched
    Reg --> AC[authClient.ts: register]:::touched
    AC -->|POST /auth/register| Ctl[auth.controller.ts: new route]:::touched
    Ctl --> RS[registration.service.ts: new]:::touched
    RS --> Port[cognito-auth.port.ts: createUser]:::touched
    Port --> Aws[aws-cognito-auth.ts: AdminCreateUser]:::touched
    RS --> User[entities/user.entity.ts]
    Mod[auth.module.ts: provide RegistrationService]:::touched --> RS
    classDef touched fill:#f96,color:#000
  ```
review_focus: |
  IN scope - the register link and form, POST /auth/register, and the Cognito createUser adapter; OUT - email verification, auto sign-in, extra profile fields, and making /shop publicly browsable. The riskiest part is the two-step create (Cognito then database row): check that a failure after Cognito creates the user does not leave a half-registered account, and that duplicate emails are checked case-insensitively. Creating accounts as 'active' and putting the Register link on the sign-in page (the signed-out view of /shop) are deliberate, flagged in the assumptions.
