# Initial Data Model Draft

This is the current draft from the grill session. It supersedes the earlier `Document`/`Block` split.

## Core Direction

Everything user-authored is a `Block`.

Daily notes are the only root blocks. Every text note, todo, meeting transcription, and generated summary belongs to exactly one daily tree through its parent chain. Opening any block renders that block and its descendant tree.

## Confirmed Invariants

- `daily` blocks are the only root blocks.
- Daily blocks are created lazily through an idempotent get-or-create operation per user and date.
- Non-root blocks derive their date from the ancestor daily block.
- Every block stores maintained `daily_block_id` membership for efficient special views and sync.
- A standalone note created from a folder still lives under today's daily block; folder assignment is only a tag.
- A todo's due date is derived from the ancestor daily block.
- A todo may have an optional due time.
- Rescheduling a todo moves the todo block and its entire subtree directly under the target daily block.
- A rescheduled todo is appended after the existing direct children of the target daily block.
- A block can have multiple direct folder assignments.
- Folder assignment applies only to the assigned block, not implicitly to descendants.
- Parent folder views aggregate blocks assigned to descendant folders, but assignments remain direct.

## Proposed Tables

### `blocks`

Canonical tree and visible content.

- `id`
- `user_id`
- `kind`: `daily | text | todo`
- `parent_block_id`: nullable only for daily blocks.
- `daily_block_id`: points to the ancestor daily block; for daily blocks it points to itself.
- `position`: stable sortable sibling order.
- `content`
- `is_collapsed`
- timestamps

Implementation rule: `text` blocks need no subtype row unless future metadata appears.

Implementation rule: when a subtree moves to another daily block, `daily_block_id` is updated for every block in that subtree.

### `daily_blocks`

Metadata for daily root blocks.

- `block_id`: primary key and FK to `blocks.id`
- `user_id`
- `date`

Invariant: unique `(user_id, date)`.

### `todo_blocks`

Metadata for todo blocks.

- `block_id`: primary key and FK to `blocks.id`
- `status`: `pending | completed | canceled`
- `due_time`: optional local `HH:mm`
- `priority`: `low | medium | high`
- `recurrence`: `weekly | monthly | yearly`
- `completed_at`

No `due_date` here. The date is derived from the daily root.

### `folders`

Hierarchical tags.

- `id`
- `user_id`
- `name`
- `slug`
- `parent_folder_id`
- `position`

### `block_folder_assignments`

Direct block-to-folder tags.

- `block_id`
- `folder_id`
- `user_id`

Folder views resolve descendant folders at query time or through a read projection; they do not materialize ancestor tags.

## Open Questions

- Whether todo recurrence creates new todo blocks or moves/reopens the same block.
- How calendar event links bind to todo blocks once due date is derived from the daily root.
