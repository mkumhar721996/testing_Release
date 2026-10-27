# testing_Release

## QA login e2e suite

Playwright tests in `apps/web/e2e-qa` exercise the real login journey on the deployed QA site (no mocks).

```
cd apps/web && pnpm run e2e:qa
```

Environment variables:

- `QA_BASE_URL` — site under test (default `https://qa.bnts-arc.ai`)
- `QA_USERNAME` / `QA_PASSWORD` — a valid QA account. Without them the valid-login tests are skipped, not failed.

The selectors are unconfirmed against the live QA DOM: a username/email label, a password label, a "Sign in" button, a combobox named "project", and `role=alert` for errors. The arc-page check (AC3) only asserts the selected project's name appears outside the dropdown and the login form is gone; pin it to a stable heading or URL once the real page is known.
