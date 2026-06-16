# libt app

Mobile-first rewrite of the existing `libt` personal notes app in `/Users/raimundomena/Local/projects/libt`.

This repo intentionally starts model-first. The current app grew from daily notes into tasks, folders, calendar, meeting transcription, AI agent tools, and daily review. The rewrite keeps the same stack and feature surface, but splits the data model before rebuilding the UI.

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
- The first Drizzle and Zero schema draft separates documents, blocks, tasks, folders, recordings, calendar links, and agent messages.
- `docs/modeling/current-app-analysis.md` records the issues observed in the existing app.
- `docs/modeling/initial-data-model.md` is the starting point for the grill session.

## Commands

```bash
npm install
npm run dev
npm run lint
npm run build
npm run db:generate
```

