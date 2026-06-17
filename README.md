# libt app

Mobile-first rewrite of the existing `libt` personal notes app in `/Users/raimundomena/Local/projects/libt`.

This repo intentionally starts model-first. The current app grew from daily notes into tasks, folders, calendar, meeting transcription, AI agent tools, and daily review. The rewrite keeps the same stack and feature surface, but starts from a block-only domain model before rebuilding the UI.

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Drizzle ORM with PostgreSQL
- Zero sync
- Custom auth/session model
- OpenAI transcription and OpenRouter agent/summary calls
- Google Calendar integration
- Playwright

## Current State

- Project scaffold is initialized.
- Drizzle and Zero are configured around the agreed block-only model.
- Auth UI and API endpoints are available under `/login`, `/register`, and `/api/auth/*`.
- Zero query/mutate endpoints are available under `/api/zero/*`.
- Domain rules for dates, positions, rescheduling, and recurring todos live in `src/lib/blocks`.
- `docs/modeling/current-app-analysis.md` records the issues observed in the existing app.
- `docs/modeling/initial-data-model.md` records the current data model consensus.
- `AGENTS.md` records repo-wide engineering conventions for future agents.

## Commands

```bash
npm install
npm run db:setup
npm run db:migrate
npm run db:seed
npm run dev
npm run lint
npm run build
npm run test
npm run db:generate
npm run db:reset
npm run db:verify
npm run test:e2e
```

`npm run db:reset` drops the local app and Drizzle migration schemas, reruns Drizzle migrations, and runs seeders. `npm run db:verify` checks that the database is reachable and has all local migrations applied. The default seeded active user is `active@example.com` with password `password123`; override it with `SEED_ACTIVE_USER_EMAIL` and `SEED_ACTIVE_USER_PASSWORD`.
