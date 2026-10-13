# Budget Calculator — AGENTS.md

## Role

You are working as an implementation agent for the Budget Calculator project.

Follow the existing architecture and make small, reviewable, testable changes.
Do not rewrite the application from scratch.

## Project structure

The project consists of two separate services:

### Frontend

Stack:

- React
- Vite
- TypeScript
- Redux
- MUI
- React Hook Form
- Yup
- Jest
- ESLint

Repository:

- `mkozhevnikov2323/digit-budget-calculator`

### Backend

Stack:

- Node.js
- Express
- JavaScript
- CommonJS

Repository:

- `mkozhevnikov2323/digit-budget-calculator-api`

Do not migrate the backend to TypeScript unless explicitly approved.

### Database

- MongoDB

Do not change MongoDB document structure without explicit approval and a migration plan.

## Product scope

The application supports:

- income tracking;
- expense tracking;
- system and user-defined categories;
- loans;
- tables, statistics, and charts;
- authentication;
- future multi-user usage;
- future multi-platform support.

Financial data is critical and must be handled conservatively.

## General development principles

- Prefer small, isolated changes.
- Keep changes easy to review and verify.
- Avoid unrelated refactoring.
- Do not change public APIs unless necessary.
- Do not change database schemas without explicit approval.
- Preserve backward compatibility where practical.
- Prefer existing project patterns over introducing new abstractions.
- Do not add dependencies unless they are clearly justified.
- Do not perform broad architectural changes without approval.
- Do not silently change user-visible behavior outside the requested scope.
- Add or update tests for every new feature and every bug fix affecting business logic.

## Refactoring rules

Before any significant refactor, first explain:

1. the problem;
2. the proposed solution;
3. alternatives considered;
4. risks;
5. expected migration or rollout impact.

Stop and ask for approval before implementing a significant refactor.

Do not rewrite entire modules or layers unless there is a strong, explicitly approved reason.

## Financial safety rules

Treat all financial operations as critical.

For create, update, and delete flows:

- never report success before persistence succeeds;
- do not clear user-entered data after a failed mutation;
- do not close edit UI after a failed mutation;
- avoid duplicate transaction risks;
- use explicit success/failure handling for async mutations;
- keep cache invalidation consistent for affected financial aggregates;
- do not log financial form values or transaction payloads to the console.

When auxiliary data such as categories, recipients, titles, or sources is synchronized separately, the financial transaction is the primary operation.

If a financial transaction succeeds but auxiliary synchronization fails, do not make the user believe the financial transaction failed.

## Authentication and navigation rules

Preserve current protected routes on browser refresh when the session is valid.

Do not redirect authenticated users to `/` merely because user data is still loading.

Only treat authentication as failed after a confirmed unauthorized response or missing token according to the existing auth flow.

After successful login or registration followed by auto-login, the default destination is:

`/expenses`

Do not force users to `/expenses` on every authenticated refresh.

## AI / OCR / receipt photo rules

The first major AI-assisted feature is financial operation entry from a receipt photo.

Required safety flow:

`Photo -> recognition -> ExpenseDraft -> user review/edit -> explicit confirmation -> save`

Never automatically persist a recognized financial transaction.

Recognition output must be treated as a draft only.

Prefer local processing when quality is acceptable.

Do not send receipt images or financial data to third-party services without explicit approval.

Do not add paid AI/OCR services without explicit approval.

Do not persist uploaded receipt images unless explicitly approved.

Do not re-enable, replace, or redesign OCR/QR functionality unless the task explicitly asks for it.

## Branch and Git workflow

GitHub is the source of truth.

Before starting work:

```bash
git status
git branch --show-current
git fetch origin
```

If the working tree contains unexpected uncommitted changes, stop and report them instead of discarding them.

Do not use destructive commands such as:

```bash
git reset --hard
git clean -fd
```

unless explicitly instructed.

Do not discard or overwrite user changes.

For bug fixes and isolated work:

- use a dedicated branch;
- base new branches on the latest intended integration branch or `main`;
- confirm the active branch before editing;
- avoid mixing unrelated features in one branch.

The receipt photo / QR / OCR work must remain separate unless explicitly approved for integration.

Before pushing:

```bash
git diff --check
git diff --stat
git diff --name-only
git status
```

Each commit should represent one logical change where practical.

Commit messages should be concise and written in English.

## Testing and verification

Before finishing a frontend task, run the relevant targeted tests first.

Then run:

```bash
npm run build
npm test -- --runInBand
npm run lint
```

The current frontend baseline is expected to be green.

Do not ignore new failures.

If failures are unrelated and clearly pre-existing, report them separately and do not silently fix them outside task scope.

Do not delete tests or weaken meaningful assertions just to make the suite pass.

Prefer regression tests that reproduce the bug before the fix and pass after the fix.

## Frontend-specific guidance

Prefer:

- strong TypeScript types;
- existing Redux and RTK Query patterns;
- React Hook Form for forms;
- accessible Testing Library queries;
- behavior-oriented tests over implementation-detail tests.

Avoid unsafe casts when the underlying type mismatch can be fixed correctly.

Do not treat paginated API response objects as arrays.

Keep server response contracts aligned with frontend types.

When using RTK Query mutations, use `.unwrap()` when success-only UI behavior depends on actual request success.

## Backend-specific guidance

The backend is currently JavaScript/CommonJS.

Do not introduce TypeScript migration work unless explicitly requested.

Preserve existing route shapes and API contracts unless a change is necessary and approved.

For multi-user data access, queries that read, update, or delete user-owned entities must remain scoped to the authenticated owner.

Do not weaken authorization checks.

## MongoDB rules

MongoDB `_id` is the canonical document identifier.

Do not rename `_id` in persistence models just to match URL parameter names.

A route such as:

`PATCH /expenses/:id`

may correctly use `req.params.id` as the value for MongoDB `_id`.

Do not change this pattern without a specific reason.

No schema changes, migrations, index changes, or data transformations without explicit approval.

## Dependencies

Before adding a dependency:

- confirm existing libraries cannot reasonably solve the problem;
- prefer small, well-maintained packages;
- avoid introducing overlapping libraries;
- report bundle/runtime impact when relevant.

Stop for approval before adding:

- paid services;
- external AI/OCR providers;
- services that receive financial data;
- image persistence/storage services.

## Scope control

Do not automatically fix adjacent issues unless they directly block the requested task.

If you find additional problems:

- report them;
- classify their severity;
- propose a follow-up task;
- keep the current diff focused.

## Communication

Respond to the user in Russian.

Use English for:

- code;
- identifiers;
- filenames;
- commands;
- branch names;
- commit messages;
- API paths.

Final task reports should be concise and include:

- root cause;
- files changed;
- behavior before/after;
- tests added or updated;
- build/test/lint results;
- known unrelated issues;
- commit hash(es);
- push result.

## Stop conditions

Stop and ask for approval before:

- significant architectural refactoring;
- public API changes;
- MongoDB schema changes;
- backend migration to TypeScript;
- changing authentication architecture;
- introducing a new external AI/OCR provider;
- sending financial data to third parties;
- adding paid services;
- persisting uploaded receipt images;
- large dependency changes;
- merging the receipt photo feature into the main development line;
- destructive Git operations;
- changes that could cause data loss or duplicate financial transactions.

When in doubt, prefer the smaller and safer change.

## Verification and token efficiency

- Do not run tests, lint, builds, type checks,
  coverage, benchmarks or installations unless
  explicitly authorized in the current task prompt.
- Verification modes: NONE, TARGETED and FULL.
  Default to NONE when no mode is specified.
- TARGETED: run only the explicitly listed commands.
- FULL: run only the complete checks listed in the prompt.
- New features and business-logic fixes must include
  focused tests; request clarification if required
  verification was not authorized.
- Do not repeatedly run successful checks.
- Do not investigate unrelated test failures.
- Avoid repository-wide searches and unnecessary reads.
- Keep tool output short and summarize failures.
- Git status and diff checks are permitted.
- Report unrun verification honestly.
