summary: |
  Let a signed-out visitor register from the shopping page. Today `Shell` in `apps/web/src/App.tsx` sends every signed-out visitor to `SignInPage`, so a visitor never sees the shopping page at `/shop`. This plan (1) renders `ShoppingPage` for signed-out visitors at `/shop` with a "Register" control that reveals a registration form (email + password) on that page (AC1), and (2) adds `POST /auth/register` to the API, which creates the account in Cognito and a `users` row, wired to the form's submit (AC2). Tests are written first at each layer (vitest for the web app, jest for the API).
scope:
  - description: |
      API port + adapter. Add `signUp` to `CognitoAuthPort` and implement it in `AwsCognitoAuth` using `AdminCreateUserCommand` (MessageAction SUPPRESS) followed by `AdminSetUserPasswordCommand` with `Permanent: true`. Map `UsernameExistsException` to a new `EmailAlreadyRegisteredError` and `InvalidPasswordException` to the existing `PasswordPolicyError`. Add `signUp: jest.fn()` to `fakeCognito()`.
      ```ts
      // cognito-auth.port.ts
      signUp(email: string, password: string): Promise<{ sub: string }>;
      ```
    files:
      - services/api/src/auth/cognito-auth.port.ts
      - services/api/src/auth/aws-cognito-auth.ts
      - services/api/src/auth/aws-cognito-auth.spec.ts
      - services/api/src/auth/auth.errors.ts
      - services/api/src/auth/testing/fakes.ts
    rationale: |
      Cognito is the identity provider (ADR-0007); the port keeps services testable with fakes, as `ActivationService` already does.
  - description: |
      Registration service. New `RegistrationService.register(email, password)` normalises the email (trim + lowercase, as `AuthService.signIn` does), refuses an existing `users` row, calls `cognito.signUp`, then saves a `User` with `status: 'active'` and the returned `cognitoSub`. Returns `{ id, email }`. Register it in `AuthModule` providers.
      ```ts
      async register(email: string, password: string): Promise<{ id: string; email: string }>
      ```
    files:
      - services/api/src/auth/registration.service.ts
      - services/api/src/auth/registration.service.spec.ts
      - services/api/src/auth/auth.module.ts
    rationale: |
      Mirrors `ActivationService` structure (injected repo, `COGNITO_AUTH`, `Clock`-free). Account is active immediately because the AC says only that an account is created.
  - description: |
      Controller endpoint `POST /auth/register` (HTTP 201) in `AuthController`. Body validated like the other handlers (`typeof` string checks, non-empty). Invalid or missing fields give 400 `{ code: 'registration_invalid' }`; `PasswordPolicyError` gives 400 `{ code: 'password_policy' }` with the existing message; `EmailAlreadyRegisteredError` gives 409 `{ code: 'email_taken' }`. Add the message constants to `auth.constants.ts`.
    files:
      - services/api/src/auth/auth.controller.ts
      - services/api/src/auth/auth.constants.ts
    rationale: |
      Follows the existing error-to-HTTP mapping style in `activate`.
  - description: |
      Web client + form. Add `register(email, password): Promise<RegisterResult>` to `authClient.ts` (same shape as `activate`). New `RegistrationForm` component (email and password inputs, "Create account" submit, `role="alert"` for errors, a `role="status"` "Account created" message on success). `ShoppingPage` gains a prop `signedIn?: boolean` (default `true`, so existing tests are unaffected); when false it skips `listProducts()` (the endpoint is session-guarded and would 401) and renders a "Register" button that toggles `RegistrationForm` on the page.
      ```ts
      export type RegisterResult = { ok: true } | { ok: false; code: string; message: string };
      export async function register(email: string, password: string): Promise<RegisterResult>
      export function ShoppingPage({ signedIn = true }: { signedIn?: boolean })
      ```
    files:
      - apps/web/src/auth/authClient.ts
      - apps/web/src/auth/RegistrationForm.tsx
      - apps/web/src/auth/RegistrationForm.test.tsx
      - apps/web/src/shop/ShoppingPage.tsx
      - apps/web/src/shop/ShoppingPage.test.tsx
    rationale: |
      AC1 requires the form to appear on the shopping page, not a separate route. Styling is Tailwind, matching `ActivatePage`.
  - description: |
      Routing. In `Shell`, when there is no user and the path is `/shop`, render `<ShoppingPage signedIn={false} />` instead of `SignInPage`. All other signed-out paths still show `SignInPage`.
    files:
      - apps/web/src/App.tsx
      - apps/web/src/App.test.tsx
    rationale: |
      Without this change a signed-out visitor cannot reach the shopping page at all.
  - description: |
      Playwright e2e covering both ACs against stubbed routes (`/auth/session` 401, `/auth/register` 201), in the style of `shop.spec.ts`.
    files:
      - apps/web/e2e/register.spec.ts
    rationale: |
      End-to-end proof of the user-visible flow.
tests:
  - |
    AC1, web (write first, fails). In `apps/web/src/shop/ShoppingPage.test.tsx`:
    ```tsx
    it("shows a registration form when a signed-out visitor chooses to register (AC1)", async () => {
      render(<ShoppingPage signedIn={false} />);
      expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: /register/i }));
      expect(screen.getByRole("heading", { name: /shop/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(client.listProducts).not.toHaveBeenCalled();
    });
    ```
  - |
    AC1, routing. In `apps/web/src/App.test.tsx`:
    ```tsx
    it("renders the shopping page with a Register control at /shop when signed out (AC1)", async () => {
      vi.mocked(client.getSession).mockResolvedValue(null);
      window.history.pushState({}, "", "/shop");
      render(<App />);
      expect(await screen.findByRole("button", { name: /register/i })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Sign in" })).not.toBeInTheDocument();
    });
    ```
  - |
    AC2, web form. In `RegistrationForm.test.tsx`:
    ```tsx
    it("submits the filled-in form and confirms the account was created (AC2)", async () => {
      vi.mocked(client.register).mockResolvedValue({ ok: true });
      render(<RegistrationForm />);
      await userEvent.type(screen.getByLabelText(/email/i), "ada@example.com");
      await userEvent.type(screen.getByLabelText(/password/i), "correct-horse-1");
      await userEvent.click(screen.getByRole("button", { name: /create account/i }));
      expect(client.register).toHaveBeenCalledWith("ada@example.com", "correct-horse-1");
      expect(await screen.findByRole("status")).toHaveTextContent("Account created");
    });
    it("shows the server message when registration fails", async () => {
      vi.mocked(client.register).mockResolvedValue({ ok: false, code: "email_taken", message: "taken" });
      // fill + submit ...
      expect(await screen.findByRole("alert")).toHaveTextContent("taken");
    });
    ```
  - |
    AC2, service. In `registration.service.spec.ts` (uses `FakeRepo<User>` and `fakeCognito()`):
    ```ts
    it('creates an account for a new visitor (AC2)', async () => {
      cognito.signUp.mockResolvedValue({ sub: 'sub-1' });
      const created = await registration.register(' Ada@Example.com ', PASSWORD);
      expect(cognito.signUp).toHaveBeenCalledWith('ada@example.com', PASSWORD);
      expect(created.email).toBe('ada@example.com');
      expect(users.rows).toEqual([
        expect.objectContaining({ email: 'ada@example.com', cognitoSub: 'sub-1', status: 'active' }),
      ]);
    });
    it('refuses a duplicate email without calling Cognito', async () => {
      await pendingUser('ada@example.com');
      await expect(registration.register('ada@example.com', PASSWORD)).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
      expect(cognito.signUp).not.toHaveBeenCalled();
    });
    it('creates no row when Cognito rejects the password', async () => {
      cognito.signUp.mockRejectedValue(new PasswordPolicyError());
      await expect(registration.register('a@b.com', 'x')).rejects.toBeInstanceOf(PasswordPolicyError);
      expect(users.rows).toHaveLength(0);
    });
    ```
  - |
    AC2, adapter. In `aws-cognito-auth.spec.ts`, assert `signUp` sends `AdminCreateUserCommand` then `AdminSetUserPasswordCommand` with `Permanent: true`, returns the `sub` attribute, and that `UsernameExistsException` becomes `EmailAlreadyRegisteredError`.
  - |
    AC2, HTTP. Controller test (supertest, as other auth specs do if present, otherwise a jest controller unit test):
    ```ts
    await request(app.getHttpServer()).post('/auth/register').send({ email: 'ada@example.com', password: 'correct-horse-1' }).expect(201);
    await request(app.getHttpServer()).post('/auth/register').send({ email: 'ada@example.com' }).expect(400);
    ```
  - |
    E2E, `apps/web/e2e/register.spec.ts`: stub `**/auth/session` with 401 and `**/auth/register` with 201, `page.goto("/shop")`, click Register, fill email and password, click "Create account", `await expect(page.getByText("Account created")).toBeVisible()`.
assumptions_or_open_questions:
  - |
    The story does not name the required fields. I assumed email and password, since the `users` entity holds only email and Cognito sub, and Cognito signs in by email. Confirm whether name or other fields are wanted.
  - |
    Newly registered accounts are created `active` with a permanent password, with no email verification or activation step, because the AC only says an account is created. Confirm whether email verification is expected.
  - |
    A duplicate email returns 409 `email_taken`, which reveals that an account exists. The password-reset flow deliberately hides this. I chose clear feedback because the form needs it. Confirm that trade-off.
  - |
    Registration does not sign the visitor in automatically; the form shows "Account created" and the visitor signs in as before. Auto sign-in is out of scope.
  - |
    Signed-out visitors see the shopping page without the product list, because `GET /products` is session-guarded and making it public is not requested.
  - |
    The AWS SDK package already used (`@aws-sdk/client-cognito-identity-provider`) provides the new commands, and the Cognito app/IAM role must be allowed `cognito-idp:AdminCreateUser`. I did not verify the deployed IAM policy.
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout

  None — no schema change: `register` writes rows in the existing `users` table (`email`, `cognitoSub`, `status`) and adds no migration, setting or env var. Provisioning: the API's AWS role needs `cognito-idp:AdminCreateUser` in addition to the Admin calls it already makes (`AdminSetUserPassword`, `AdminEnableUser`, `AdminGetUser`). Deploy the API before the web app so the form never posts to a missing route. Rollback: revert both; accounts already created are ordinary active users and stay valid.

  ```mermaid
  flowchart TD
    App[App.tsx Shell]:::touched --> SP[ShoppingPage.tsx]:::touched
    SP --> RF[RegistrationForm.tsx]:::touched
    RF --> AC[authClient.ts]:::touched
    AC -->|POST /auth/register| CT[auth.controller.ts]:::touched
    CT --> RS[registration.service.ts]:::touched
    RS --> PORT[cognito-auth.port.ts]:::touched
    PORT --> AWS[aws-cognito-auth.ts]:::touched
    RS --> U[entities/user.entity.ts]
    AM[auth.module.ts]:::touched -.provides.-> RS
    classDef touched fill:#f96,color:#000
  ```

  Existing ShoppingPage tests render it with no props, so `signedIn` defaults to `true` to keep them unchanged.
review_focus: |
  IN scope: a Register control and email+password form on the signed-out `/shop` page, and `POST /auth/register` creating a Cognito user plus an active `users` row. OUT: email verification, auto sign-in, public product listing, extra profile fields. Riskiest part is the Cognito adapter (create-then-set-permanent-password is two calls, so a failure between them can leave an orphan Cognito user) and the `Shell` routing change. `signedIn` defaulting to `true` is deliberate so existing ShoppingPage tests stay valid.
