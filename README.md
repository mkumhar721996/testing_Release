# testing_Release

## QA login e2e suite

Playwright tests in `apps/web/e2e-qa` exercise the real login journey on the deployed QA site (no mocks).

```
cd apps/web && pnpm run e2e:qa
```

Environment variables:

- `QA_BASE_URL` — site under test (default `https://qa.bnts-arc.ai`)
- `QA_USERNAME` / `QA_PASSWORD` — a valid QA account. Without them the valid-login tests are skipped, not failed.
