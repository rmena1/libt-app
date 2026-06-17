# Agent Conventions

This file contains global rules for agents working in this repository. Add only conventions that apply across the whole project; feature-specific decisions belong in domain docs, PRDs, ADRs, or local code comments.

If the user mentions a convention that applies repo-wide, such as deep modules, testing strategy, code style, architectural boundaries, or general implementation discipline, the agent should offer to add that convention to this file.

## Architecture

- Prefer deep modules: expose small, stable APIs that hide meaningful implementation complexity.
- Keep domain rules out of UI components and route handlers. UI and routes should validate input, call a domain/service API, and render/return the result.
- Use the block-first domain language from `CONTEXT.md`; avoid reintroducing page/document concepts for user-authored content.
- Model projections explicitly. Special views can filter/group blocks, but they must not become a second source of truth.

## UI Design

- Follow the current app style for every new UI: white and very light gray surfaces, black text, subtle gray borders, soft card shadows, 8px radii, and monospaced typography.
- Do not introduce accent color palettes for UI chrome. Bullets, controls, and state markers should stay neutral/black/gray unless a domain state explicitly requires a semantic color such as error or success.
- Keep interfaces quiet and tool-like, matching the current content-focused design rather than adding decorative backgrounds, gradients, or browser/window chrome.

## Data Access

- Do not use Active Record or TypeORM-style entity objects with behavior attached to mutable rows.
- Keep persistence in repository/service functions and keep pure domain planning functions testable without a database.
- Prefer database constraints for invariants that Postgres can express clearly, and service/mutator tests for cross-row or subtype invariants.

## Testing

- Add unit tests for domain planning rules before or alongside implementation.
- Keep fast tests focused on pure modules where possible.
- Broaden to integration or e2e tests when changing auth, sync, persistence transactions, or user-facing flows.
- Every product feature must include e2e coverage for its main user-visible workflow.
- Keep database seeders current with the workflows covered by e2e tests.
- After high-complexity implementations, reset the local database and run the full e2e suite to validate the app end to end.
- When any test, linter, build, migration check, or validation fails, fix every failure before considering the work complete. Do not ignore failures because they appear unrelated to the immediate change.

## Database

- Apply database shape changes through migrations.
- Keep local database setup, reset, migration, and seeding scripts working so test data is reproducible.
