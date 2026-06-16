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
- Auth API endpoints are available under `/api/auth/*`.
- Zero query/mutate endpoints are available under `/api/zero/*`.
- Domain rules for dates, positions, rescheduling, and recurring todos live in `src/lib/blocks`.
- `docs/modeling/current-app-analysis.md` records the issues observed in the existing app.
- `docs/modeling/initial-data-model.md` records the current data model consensus.
- `AGENTS.md` records repo-wide engineering conventions for future agents.

## Commands

```bash
npm install
npm run dev
npm run lint
npm run build
npm run test
npm run db:generate
```
