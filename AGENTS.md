# Suivi des dossiers — Instructions for Codex

Internal web app where a small team of customer-service agents logs, tracks and escalates customer cases. Stack: React + TypeScript + Vite, Supabase (database and login), Cloudflare Pages (hosting). `main` deploys to production automatically.

## How to work with the owner

The owner runs the business and has no coding background. They decide **what** the app must do; you decide **how**.

- Make all technical decisions yourself (libraries, structure, naming, tests). Choose the most robust option after weighing alternatives.
- Ask only business questions, one at a time, in plain language, with your recommended answer. Never ask the owner to run commands, edit files, read code or paste SQL.
- Reports are in plain language, with no jargon. If a technical term is unavoidable, explain it in half a sentence. Format: what changed for users, what was checked, what the owner should test in the app (2 to 5 concrete steps), what is still pending. Do not list files unless asked.
- Reply in the language the owner writes in. All text shown in the app is French.
- Challenge requests that conflict with the business rules or that have a clearly better alternative. Say so before building.

## Documentation map

Each fact lives in exactly one place. Link to it, never copy it.

| File | Holds | Update when |
|---|---|---|
| `docs/product.md` | Business rules: statuses, teams, roles, case lifecycle, permissions, KPI definitions, constraints | A business rule changes |
| `docs/architecture.md` | Stack, deployment, environment variables, data flow, database objects and invariants | Structure, stack or schema changes |
| `docs/decisions.md` | Log of significant decisions with date, reason and rejected alternatives. Append only: supersede, never rewrite | A lasting decision is made |
| `docs/roadmap.md` | Current phase, backlog, known issues | Every work session |
| `docs/qa-checklist.md` | Manual test path of the main workflows | A feature is added or changed |

The code and the live database are the truth for what exists. The docs are the truth for intent. If they disagree, tell the owner. Do not silently pick one.

## Every task

1. Read the docs relevant to the task and check `git status` before editing.
2. Work on a branch (`feature/<topic>` or `fix/<topic>`). Make small, coherent changes. No broad rewrites.
3. Validate for real: `npm run lint`, `npm test`, `npm run build` may run locally or in the GitHub Actions workflow. For UI changes, run the affected path of `docs/qa-checklist.md` in a browser when tooling is available. Report exact results. Never claim a check passed that you did not run.
4. Update the docs in the same change whenever a rule, structure, schema object or decision changes. Add QA steps for new features.
5. Commit with clear, imperative messages.
6. Merge a branch to `main` only when the required checks are green, any required database migration is already applied and verified, and nothing under "Ask first" is pending. Then confirm the deployment succeeded, or tell the owner what to look at.
7. If a merged change breaks production, revert first, diagnose after, and tell the owner.

You own git. Never force-push, rewrite the history of `main`, or delete a branch that holds unmerged work. Never commit secrets (`.env*`).

## Ask first

Stop and ask the owner, in plain words (what could be lost or blocked, and your recommendation), before:

- changing a business rule (statuses, teams, ownership, KPI definitions, who sees what);
- any database change that deletes or rewrites existing data, drops or renames an existing object, changes login or access rules (RLS, policies, grants), or could stop agents from working;
- removing a feature or data that users can see;
- adding anything that costs money (paid plan, paid service, paid feature). The project must stay free.

Allowed without asking: read-only inspection, and additive database changes (new table, column, index, function, trigger) that have a rollback plan and are verified after being applied.

## Database and security

- The live database and `supabase/` are the truth for the data model. `supabase/baseline.sql` is a read-only reference snapshot until restore-tested. Files in `supabase/history/` are already applied to live and must never be re-run. New schema changes go in timestamped files under `supabase/migrations/`, additive whenever possible, with rollback steps in the header.
- Row Level Security stays enabled on every table. Never bypass it from the browser. Never use a service-role key in front-end code. Only the public URL and anon key exist in the browser.
- Secondary features (notifications, logs) must never block a user action. Wrap their database logic so a failure raises a warning, not an error.
- No fake or demo data, and no fallback that hides a real error. Show real error states.
- Prefer read-only checks on live data. If a write test is unavoidable, ask first, label the data `TEST`, and report exactly what was created.
- Never print, log or commit secrets or customer data (names, contacts) in reports, screenshots, tests or commits.

## Engineering standards

- Preserve business meaning. Freely improve structure, performance, accessibility and design.
- Every user action gets visible success or error feedback. Never swallow an error.
- No full-page reload for normal actions. Keep selection, search and drafts across refreshes. Update only what changed instead of reloading everything.
- Business logic lives in `src/lib` with unit tests. A bug fix comes with a test when practical.
- When touching a file over about 500 lines, extract what you touch into a smaller component instead of growing it.
- Add a dependency only if it solves a real problem, and record it in `docs/decisions.md` if the choice is lasting.
- Design: calm, modern work inbox (views, case list, selected case, quick actions, journal, next and previous case). Use color only to convey meaning. Laptop first, usable on narrower screens. Help Scout is a reference for workflow only. Do not copy its interface or labels.

## Keeping this file healthy

Keep it short and stable: no task lists, no status, no business facts (those belong in `docs/`). If a rule stops being true, fix it in the same task. Lasting instructions from the owner go into the matching doc.

- If a network call fails, try one alternative route, then stop and report. Never retry blocked installs.
