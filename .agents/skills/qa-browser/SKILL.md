# Browser QA — SEZ.26

Use this skill when validating user-facing flows in the running application.

## Critical smoke paths

- Sign in with the designated test account supplied at runtime by the user.
- Open the main case list.
- Switch work views.
- Search/filter cases.
- Open a case.
- Navigate to next/previous case.
- Change status / assignment where supported.
- Add an internal note and a customer update where supported.
- Archive and restore a case.
- Open reporting and change the KPI period.
- Sign out.

## Rules

- Never store credentials in the repository, screenshots, test fixtures, or logs.
- Use credentials only at runtime.
- Prefer Playwright or the browser tooling already configured in the repository for local automated checks.
- Use a live browser connector for deployed-site verification when available.
- Report the exact failing step, visible symptom, and console/network evidence when a flow fails.
