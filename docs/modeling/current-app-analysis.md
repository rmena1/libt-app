# Current App Analysis

Source inspected: `/Users/raimundomena/Local/projects/libt`.

## Technology Surface To Keep

- Next.js App Router, React, TypeScript, Tailwind CSS.
- Drizzle ORM over PostgreSQL.
- Zero for local-first sync.
- Custom auth with `users` and `sessions`.
- Server actions and API routes.
- OpenAI audio transcription.
- OpenRouter for summaries, meeting task extraction, and the in-app agent.
- Google Calendar OAuth and event CRUD.
- Playwright for UI tests.

## Functional Surface To Preserve

- Daily notes as the primary home view.
- Infinite daily timeline.
- Every line can behave as a page/note.
- Nested outlines with expand/collapse.
- Tasks created from note lines.
- Task metadata: completed state, completion timestamp, due date, priority, recurrence.
- Task projections into daily views and task views.
- Folders with nested navigation and slug routes.
- Folder assignment from note content.
- Starred/favorite notes.
- Search across notes.
- Google Calendar connection and calendar event links.
- Meeting and video recording upload/transcription.
- Meeting summary insertion.
- Meeting follow-up task extraction.
- Daily review state.
- In-app agent with tools to read/write/edit notes, create tasks, search notes, list/create folders, read calendar events, manage memory/instructions, and select models.

## Main Data Model Problems

The current `pages` table is doing too much:

- It is a note line.
- It is an addressable page.
- It is a tree node.
- It is a task.
- It stores task state.
- It stores calendar event linkage.
- It stores favorite and collapsed UI state.
- It stores daily placement.
- It stores folder placement.
- It stores both visual indentation and relational parentage.

This forces fragile code paths:

- Daily view reconstructs trees from `indent`, `order`, and `parentPageId`.
- Folder linking mutates visual children into actual children after the fact.
- Meeting summaries and follow-up tasks scan subsequent rows by `order` until indentation drops.
- Task projections query `pages` as if tasks were first-class records.
- Agent tools expose `page` for everything, so tool contracts inherit the ambiguity.
- Calendar links are single text fields on the note line, not integration records.
- Agent conversations store messages as JSON text, which makes querying, migration, and tool audit harder.

## Rewrite Constraint

The rewrite should preserve feature parity, not preserve the old table boundaries.

