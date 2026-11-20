summary: |
  Let an employee record an expense and save it as a draft from a new-expense form on a new Expenses screen (`/expenses`). The form has amount, date, category, description and an optional receipt (PDF/JPG/PNG, at most 10 MB). Only amount and date are required for a draft. The web app validates inline as the employee types or attaches, and the API re-validates the same rules (amount > 0, date not in the future and at most 60 days old, receipt type and size). The API stores the draft in PostgreSQL via TypeORM, writes the receipt file to S3 behind a storage port (ADR-0019) and writes an audit entry in the same transaction (ADR-0028). Submitting, editing, the expense list and spending-limit warnings belong to other stories and are out of scope.
scope:
  - description: |
      API validation module (pure, no Nest deps beyond BadRequestException), mirroring `employees/employee-input.ts`.
      ```ts
      export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
      export const RECEIPT_TYPES = { 'application/pdf': ['.pdf'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] };
      export const DATE_WINDOW_DAYS = 60;
      export interface ExpenseDraftInput { amount: unknown; date: unknown; category?: unknown; description?: unknown }
      export interface ExpenseDraftFields { amountMinor: number; incurredOn: string; category: string | null; description: string | null }
      export function parseExpenseDraft(body: unknown, categories: string[], today: Date): ExpenseDraftFields;
      export function assertReceipt(file: { originalname: string; mimetype: string; size: number }): void;
      ```
      Error codes (BadRequestException `{ code }`): `amount_invalid`, `date_invalid`, `date_in_future`, `date_too_old`, `category_invalid`, `receipt_type_invalid`, `receipt_too_large`. Amount is a positive finite number, stored as integer minor units (`Math.round(v * 100)`). Day arithmetic uses UTC day numbers so DST cannot shift the 60-day boundary. Category is optional but, when given, must be in the configured list.
    files:
      - services/api/src/expenses/expense-input.ts
      - services/api/src/expenses/expense-input.spec.ts
    rationale: |
      Pins ACs 5-14 server-side so the API is the authority (ADR-0017) and the web rules are a convenience.
  - description: |
      Expense entity (table `expenses`): id uuid PK, ownerUserId uuid, amountMinor int, currency varchar, incurredOn date, category varchar null, description text null, receiptKey varchar null, receiptName varchar null, receiptContentType varchar null, receiptSizeBytes int null, status varchar default 'draft', createdAt/updatedAt timestamptz. Only metadata about the receipt is in PostgreSQL (ADR-0019). Extend the `AuditEntry.entity`/`action` usage by writing `entity: 'expense'`, `action: 'create'` (no change to the audit entity is needed, `entity` is a free varchar).
    files:
      - services/api/src/expenses/expense.entity.ts
    rationale: |
      New table; entities are auto-loaded via `TypeOrmModule.forFeature` (`autoLoadEntities: true` in app.module.ts).
  - description: |
      Receipt storage port plus S3 adapter, so tests use an in-memory fake and ADR-0019 is honoured.
      ```ts
      export abstract class ReceiptStorage {
        abstract put(key: string, body: Buffer, contentType: string): Promise<void>;
        abstract remove(key: string): Promise<void>;
      }
      ```
      `S3ReceiptStorage` uses `S3Client` (region from `AWS_REGION`, default `us-east-1` per ADR-0022) and bucket `RECEIPTS_BUCKET`. Keys are `receipts/{expenseId}/{randomUUID}` (never the user-supplied name). `InMemoryReceiptStorage` lives in `testing/fakes.ts` following `auth/testing/fakes.ts`.
    files:
      - services/api/src/expenses/receipt-storage.ts
      - services/api/src/expenses/s3-receipt-storage.ts
      - services/api/src/expenses/testing/fakes.ts
    rationale: |
      No S3 code exists yet (searched services/api/src and package.json: only the Cognito SDK). A port keeps the unit tests off the network.
  - description: |
      Service, controller, module and permission.
      ```ts
      // expenses.service.ts
      createDraft(input: Partial<ExpenseDraftInput>, receipt: ReceiptUpload | undefined, actorUserId: string): Promise<Expense>
      categories(): string[]   // from config, see below
      // expenses.controller.ts  (@UseGuards(SessionGuard, ReadOnlyGuard, PermissionGuard))
      @Get('options')            @RequirePermission('expenses:write')  options()  -> { categories, currency, maxReceiptBytes, windowDays }
      @Post() @UseInterceptors(FileInterceptor('receipt', { limits: { fileSize: MAX_RECEIPT_BYTES + 1 } }))
                                 @RequirePermission('expenses:write')  createDraft(@Req() req, @Body() body, @UploadedFile() receipt?)
      ```
      Flow: parse and validate fields and receipt first (nothing is written on a 400), generate the id, upload the receipt, then in a `dataSource.transaction` save the Expense and an `AuditEntry` (`entity: 'expense'`, `action: 'create'`, `changes` holding the fields, never the file bytes). If the transaction fails, remove the uploaded object best-effort. `multer` limit is MAX+1 so a file of exactly 10 MB passes multer and `assertReceipt` rejects only `size > MAX_RECEIPT_BYTES`. Add `'expenses:write'` to `Action` in `access/permissions.ts`: allowed when `actor.employeeId !== null` and role is not `read_only_executive`. Register `ExpensesModule` in `app.module.ts`; it provides `{ provide: Clock, useClass: SystemClock }` (from `auth/clock.ts`) and `{ provide: ReceiptStorage, useClass: S3ReceiptStorage }`.
      Categories: `ExpensesService.categories()` reads config `EXPENSE_CATEGORIES` (comma list, same pattern as `EMPLOYEE_DEPARTMENTS` in `employees.service.ts`), so a later Categories & Spending Policy story can swap the source without touching callers (ADR-0027).
    files:
      - services/api/src/expenses/expenses.service.ts
      - services/api/src/expenses/expenses.service.spec.ts
      - services/api/src/expenses/expenses.controller.ts
      - services/api/src/expenses/expenses.module.ts
      - services/api/src/access/permissions.ts
      - services/api/src/access/permissions.spec.ts
      - services/api/src/app/app.module.ts
      - services/api/test/expenses.e2e-spec.ts
    rationale: |
      Mirrors EmployeesController/EmployeesService (guards, `RequirePermission`, transaction plus audit). Covers ACs 2, 3, 4, 13, 14 end to end.
  - description: |
      Web validation rules and API client.
      ```ts
      // expenseRules.ts
      export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
      export function validateAmount(text: string): string | null          // null = valid
      export function validateDate(text: string, today: Date): string | null // DD/MM/YYYY
      export function validateReceipt(file: { name: string; type: string; size: number }, maxBytes: number): string | null
      // expensesClient.ts
      export type ExpenseOptions = { categories: string[]; currency: string; maxReceiptBytes: number; windowDays: number };
      export function getExpenseOptions(): Promise<ExpenseOptions>
      export function createExpenseDraft(v: DraftValues, receipt: File | null): Promise<SaveResult>   // multipart FormData, credentials: "include"
      ```
      Copy states the fix (UI guidelines voice), taken from the prototype where it exists: amount "Enter an amount greater than 0, for example 38.00."; future date "Enter a date that is today or earlier. Expenses cannot be dated in the future."; old date "This expense is dated N days ago. Enter a date on or after DD/MM/YYYY."; type "Attach a PDF, JPG or PNG file."; size "This file is over the 10 MB limit. Attach a file of 10 MB or less." (the size message must name the limit, AC 7; the number comes from `maxReceiptBytes`).
    files:
      - apps/web/src/expenses/expenseRules.ts
      - apps/web/src/expenses/expenseRules.test.ts
      - apps/web/src/expenses/expensesClient.ts
    rationale: |
      Pure functions are cheap to unit-test for every AC boundary (exactly 10 MB, exactly 60 days).
  - description: |
      Expenses screen and form, built from the approved prototype (screen "Expenses", state `form`, plus its page head `h1` "My expenses" and the primary "New expense" button). Route: add `if (path === "/expenses") return <ExpensesPage />;` in `App.tsx`. The page wraps content in the existing `RecordsLayout` (sidebar and top strip, tokens only, `employees/records.css`). Prototype elements reproduced: back button "Back to my expenses" (`btn btn-ghost`, `i-arrow-left`), form column (max-width 480px, `gap: var(--space-4)`), fields Amount (`inputmode="decimal"`, placeholder `0.00`, label shows the currency from options), Date (text `DD/MM/YYYY` plus `.field-hint` with the window start computed from today), Category `<select>` populated from `options.categories`, Description `<textarea rows=3>`, and the dashed receipt box (`.receipt-box`) holding label "Receipt", file name or "No file attached. Optional for a draft.", a "Choose file" `btn btn-secondary` that opens a hidden `<input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png">`, and the `.field-error` `role="alert"` under it. Each error is a `.field-error` with `role="alert"` linked by `aria-describedby`, and the control gets `.is-invalid`. Validation runs on change/blur and on save; a rejected file is not kept (AC 6, 7). The button "Save draft" is the only `btn-primary`. On success show a `.toast.is-open` "Draft saved" (`role="status"`, auto-dismiss) and reset the form; on API failure show an `.alert.alert-danger` "The draft could not be saved. Check the fields and try again." While options load show `.skeleton` rows; if they fail show `.alert-danger` with a "Try again" `btn-secondary` (prototype error state).
      New `expenses.css` defines only what the prototype defines inline and prototype-utils.css lacks: `.form-col`, `.receipt-box`, `.receipt-box.is-invalid`, `.form-actions`, `.skel-row`, using tokens `--space-2/4/6`, `--radius-md`, `--color-border-strong`, `--color-bg-subtle`, `--input-invalid-border`. Import it in `main.tsx` after `records.css`. Classes `.field*`, `.input`, `.select`, `.textarea`, `.btn*`, `.alert*`, `.toast`, `.skeleton` already load from `design-system/prototype-utils.css` via `index.css` line 2; tokens come from line 1. Compact spacing and 44px min control height as in the prototype; below 768px the layout is the single column the prototype already uses.
      Navigation: add an "expenses" section for roles that may create expenses in `nav/navigation.ts` (read `Navigation.tsx` and `navigation.test.ts` first and extend them in the same style).
    files:
      - apps/web/src/App.tsx
      - apps/web/src/main.tsx
      - apps/web/src/expenses/ExpensesPage.tsx
      - apps/web/src/expenses/ExpenseForm.tsx
      - apps/web/src/expenses/ExpenseForm.test.tsx
      - apps/web/src/expenses/expenses.css
      - apps/web/src/nav/navigation.ts
      - apps/web/src/nav/navigation.test.ts
      - apps/web/e2e/expenses.spec.ts
    rationale: |
      ACs 1, 4 and the inline-error ACs 5-12 on the screen; ACs 2, 3, 13, 14 through the save flow. Follows `EmployeeCreatePage` (state, banner, `noValidate` form).
tests:
  - |
    AC1 (web, ExpenseForm.test.tsx), written first, fails until the form exists:
    ```ts
    render(<ExpenseForm options={opts} onSaved={vi.fn()} />);
    for (const name of [/amount/i, /date/i, /category/i, /description/i]) expect(screen.getByLabelText(name)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /choose file/i })).toBeInTheDocument();
    ```
  - |
    AC2 and AC3 (api, expenses.service.spec.ts): draft saved without and with a receipt.
    ```ts
    const d = await service.createDraft({ amount: 12.5, date: '2026-11-10', category: 'Travel', description: 'Taxi' }, undefined, 'u1');
    expect(d).toMatchObject({ status: 'draft', amountMinor: 1250, receiptKey: null });
    const w = await service.createDraft(valid, pdf(1024), 'u1');
    expect(w.receiptKey).toMatch(/^receipts\//); expect(storage.objects.has(w.receiptKey!)).toBe(true);
    expect(audit).toContainEqual(expect.objectContaining({ entity: 'expense', action: 'create' }));
    ```
    Plus the e2e: `POST /expenses` with and without a multipart `receipt` returns 201.
  - |
    AC4 (api and web): `GET /expenses/options` returns exactly the configured list, and the select renders exactly those options.
    ```ts
    expect(service.categories()).toEqual(['Meals', 'Travel', 'Office supplies']);   // config EXPENSE_CATEGORIES set in the spec
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(opts.categories);
    await expect(service.createDraft({ ...valid, category: 'Yachts' }, undefined, 'u1')).rejects.toMatchObject({ response: { code: 'category_invalid' } });
    ```
  - |
    AC5 (expenseRules.test.ts and expense-input.spec.ts), one rule for all three formats, run with `it.each`:
    ```ts
    it.each([["a.pdf","application/pdf"],["a.jpg","image/jpeg"],["a.png","image/png"]])("accepts %s at exactly 10 MB", (name, type) => {
      expect(validateReceipt({ name, type, size: 10 * 1024 * 1024 }, MAX)).toBeNull();
    });
    expect(() => assertReceipt({ originalname: 'a.pdf', mimetype: 'application/pdf', size: MAX_RECEIPT_BYTES })).not.toThrow();
    ```
  - |
    AC6: other formats are rejected inline and not attached (ExpenseForm.test.tsx uses `userEvent.upload` with `applyAccept: false`).
    ```ts
    await user.upload(input, new File(["x"], "notes.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/PDF, JPG or PNG/);
    expect(screen.getByText(/no file attached/i)).toBeInTheDocument();
    expect(() => assertReceipt({ originalname: 'a.gif', mimetype: 'image/gif', size: 10 })).toThrow(expect.objectContaining({ response: { code: 'receipt_type_invalid' } }));
    ```
  - |
    AC7: over 10 MB in each format is rejected with a message naming the limit, file not attached (`it.each` over pdf, jpg, png).
    ```ts
    expect(validateReceipt({ name: "a.png", type: "image/png", size: MAX + 1 }, MAX)).toMatch(/10 MB/);
    expect(() => assertReceipt({ originalname: 'a.pdf', mimetype: 'application/pdf', size: MAX_RECEIPT_BYTES + 1 })).toThrow(expect.objectContaining({ response: { code: 'receipt_too_large' } }));
    ```
  - |
    AC8: zero, negative and non-numeric all give the inline error (`it.each(["0", "-5", "abc"])`), in web and API.
    ```ts
    expect(validateAmount("0")).not.toBeNull();
    expect(() => parseExpenseDraft({ amount: 'abc', date: '2026-11-10' }, cats, today)).toThrow(expect.objectContaining({ response: { code: 'amount_invalid' } }));
    ```
    Form test: type `-5` into Amount and `expect(screen.getByRole("alert")).toHaveTextContent(/greater than 0/)` and `expect(amount).toHaveAttribute("aria-invalid", "true")`.
  - |
    AC9: `expect(validateAmount("38.00")).toBeNull();` and after typing `38.00` the form test asserts `expect(screen.queryByText(/greater than 0/)).not.toBeInTheDocument();`.
  - |
    AC10: with `today = new Date("2026-11-20T00:00:00")`, `expect(validateDate("21/11/2026", today)).toMatch(/today or earlier/);` and the API `date_in_future` code for `'2026-11-21'`.
  - |
    AC11: `expect(validateDate("20/09/2026", today)).toMatch(/60 days/);` (61 days back) and the API `date_too_old` code for `'2026-09-20'`.
  - |
    AC12: boundary accepted on both sides. `expect(validateDate("21/09/2026", today)).toBeNull();` and `expect(() => parseExpenseDraft({ amount: 1, date: '2026-09-21' }, cats, today)).not.toThrow();`. Add a DST-straddling date case so the day count uses UTC.
  - |
    AC13: only amount and date saves.
    ```ts
    const d = await service.createDraft({ amount: 5, date: '2026-11-10' }, undefined, 'u1');
    expect(d).toMatchObject({ category: null, description: null, receiptKey: null });
    ```
    Form test: fill Amount and Date only, click "Save draft", `expect(createExpenseDraft).toHaveBeenCalledTimes(1)` and the "Draft saved" status appears.
  - |
    AC14: empty amount or empty date blocks saving (`it.each(["amount", "date"])`).
    ```ts
    await expect(service.createDraft({ date: '2026-11-10' }, undefined, 'u1')).rejects.toMatchObject({ response: { code: 'amount_invalid' } });
    expect(repo.saved).toHaveLength(0); expect(storage.objects.size).toBe(0);
    ```
    Form test: click "Save draft" with Amount empty, `expect(createExpenseDraft).not.toHaveBeenCalled()` and an inline error shows under the field. Also permissions.spec.ts: `can(readOnlyExecutive, 'expenses:write')` is false, an employee with an `employeeId` is true. A Playwright spec (`apps/web/e2e/expenses.spec.ts`, routes mocked as in `employees.spec.ts`) covers fill, attach and save, then the toast.
assumptions_or_open_questions:
  - |
    Categories & Spending Policy is not implemented in this repo (searched the web and API source for "categor": only the unrelated shop Product.category). Until that epic lands, categories come from the config key `EXPENSE_CATEGORIES`, and the prototype's Meals, Travel and Office supplies are its own invented sample data, not a default. Decision needed: the default value, or whether to wait for the policy story and read from it. AC 4 can only be fully met once that source exists.
  - |
    Currency is undecided (open project question: "Which currency is the company currency?"). The prototype shows USD, while employee pay uses `PAY_CURRENCY` defaulting to GBP. The plan reads `EXPENSE_CURRENCY`, falling back to `PAY_CURRENCY`, and the form label shows whatever the API returns. Needs a human answer; no literal currency is hardcoded in the web app.
  - |
    Retention of expense records and receipts, and where receipts are stored, are open project questions. The plan stores receipts in S3 (ADR-0019, us-east-1 per ADR-0022) under `receipts/{expenseId}/...` with no lifecycle or deletion rule, and keeps drafts indefinitely. A retention rule needs a decision before production.
  - |
    The story says exact receipt types and maximum size are still open, but ACs 5-7 fix them at PDF/JPG/PNG and 10 MB, so the plan follows the ACs. 10 MB is taken as 10 * 1024 * 1024 bytes; confirm that it is not 10,000,000. Type is checked by MIME type plus extension only, with no content sniffing or malware scan.
  - |
    The Expenses screen here has only the new-expense form and its entry button. The prototype's list, status filters, summary cards, edit, submit ("Submit for approval"), over-limit warning and rejection notes belong to other stories and are not built. The prototype puts a primary "Submit for approval" next to "Save draft"; with submit out of scope, "Save draft" becomes the screen's single `btn-primary` (UI guideline: one primary action per screen). After saving there is no list to show the draft in, so only a toast confirms it.
  - |
    The prototype validates on save only, but the ACs say "when the employee enters the amount/date" and "when the file is attached", so the plan validates on change/blur and again on save. Amount and date errors are therefore visible before saving, and an empty amount or date only errors once touched or on save.
  - |
    Who may create expenses is not stated. The plan allows any signed-in user linked to an employee record, except the read-only executive (`expenses:write` in `access/permissions.ts`). The draft owner is the actor's user id.
  - |
    No migration framework exists in `services/api` (no migrations folder found; `synchronize` is on except when `NODE_ENV=production`, in app.module.ts). The new `expenses` table is created by synchronize outside production; how production schema changes are applied is an existing gap and is not addressed here.
estimated_points: 5
package_dependencies:
  - name: "@aws-sdk/client-s3"
    version: "^3.1153.0"
    ecosystem: npm
    component_id: comp_api_service
    rationale: |
      S3ReceiptStorage uploads and deletes receipt files in Amazon S3 (ADR-0019). Same version line as the existing Cognito SDK.
  - name: "@types/multer"
    version: "^1.4.12"
    ecosystem: npm
    component_id: comp_api_service
    rationale: |
      Types for `Express.Multer.File` used by FileInterceptor and `@UploadedFile()`. multer itself ships with `@nestjs/platform-express`.
notes: |
  ### Data & rollout
  - **Existing data**: a new `expenses` table only; no existing table or row changes, so nothing existing becomes unreadable. Audit rows use the existing `audit_entries` table with `entity: 'expense'`.
  - **Backfill / seed**: none needed.
  - **Settings**: `EXPENSE_CATEGORIES` (comma list; must be set for the category select to have choices, otherwise empty and category stays optional), `EXPENSE_CURRENCY` (falls back to `PAY_CURRENCY`, then `GBP`), `RECEIPTS_BUCKET` (no default; receipt upload returns 500 if a receipt is sent and it is unset, drafts without a receipt still work), `AWS_REGION` (default `us-east-1`). Document them in the API service README or `.env.example`, whichever exists (check before editing).
  - **Provisioning**: an S3 bucket in us-east-1 with private access and server-side encryption, and an ECS task role allowing `s3:PutObject` and `s3:DeleteObject` on `receipts/*`. Infra is outside this repo's code; it must exist before receipts can be attached.
  - **Order and rollback**: deploy the bucket and role, set the settings, then deploy the API (creates the table), then the web app. Rollback: redeploy the previous web app and API; the extra table and S3 objects are harmless to leave. To remove them, drop `expenses` and delete the `receipts/` prefix.

  The prototype is `TESTING-BROWN-17-UX-DESIGN-005-design.html`. I read all of it, including its inline script and styles. Tokens load today through `apps/web/src/index.css` (line 1 imports `design-system/tokens.css`, line 2 imports `design-system/prototype-utils.css`), so no new token wiring is needed. The prototype's inline `<style>` classes missing from `prototype-utils.css` are `.form-col`, `.receipt-box`, `.form-actions` and `.skel-row`; those are defined in `expenses.css` on the same tokens.

  ```mermaid
  flowchart TD
    App[App.tsx route /expenses]:::touched --> EP[ExpensesPage]:::touched
    EP --> RL[RecordsLayout existing shell]
    EP --> EF[ExpenseForm]:::touched
    EF --> ER[expenseRules]:::touched
    EF --> EC[expensesClient]:::touched
    EC -->|multipart POST /expenses, GET /expenses/options| CT[ExpensesController]:::touched
    CT --> GD[SessionGuard ReadOnlyGuard PermissionGuard]
    GD --> PM[access/permissions.ts expenses:write]:::touched
    CT --> SV[ExpensesService]:::touched
    SV --> IN[expense-input.ts validation]:::touched
    SV --> RS[ReceiptStorage port S3 adapter]:::touched
    SV --> DB[(expenses table and audit_entries)]:::touched
    AM[app.module.ts]:::touched --> CT
    classDef touched fill:#f96,color:#000
  ```
review_focus: |
  Hold the work to ACs 1-14 for the new-expense form and draft saving only; the list, edit, submit and limit warnings are deliberately out. The riskiest parts are the boundaries (a file of exactly 10 MB accepted, a date exactly 60 days back accepted, UTC day arithmetic) and the ordering in `createDraft`: validate everything first, upload the receipt, then write the expense and audit entry in one transaction, with cleanup of the object on failure. Categories and currency come from config because their owning stories do not exist yet, and "Save draft" is the only primary button because submit is out of scope; neither is a mistake.
