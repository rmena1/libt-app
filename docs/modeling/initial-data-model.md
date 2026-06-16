# Initial Data Model Draft

This is a draft for the grill session, not an accepted design.

## Core Recommendation

Split the current `pages` concept into separate identities:

- **Document**: an addressable writing surface such as a daily note, standalone note, meeting note, or video note.
- **Block**: one editable line inside a document. Blocks form the outline tree.
- **Task**: metadata attached to a source block when that block represents a todo.
- **Folder**: navigation and classification container.
- **Recording**: meeting/video capture process and durable transcript/summary source.
- **CalendarEventLink**: external calendar event linkage for a task or block.
- **AgentConversation / AgentMessage**: persisted agent conversation stream.

## Proposed Tables

### `documents`

Owns addressable surfaces.

- `kind`: `daily | note | meeting | video`
- `daily_date`: populated only for daily documents.
- `folder_id`: optional classification for note-like documents.
- `source_block_id`: optional pointer to the block that opened/created this document.

Invariant: one `daily` document per `(user_id, daily_date)`.

### `blocks`

Owns editable lines and outline structure.

- `document_id`: the document where the block lives.
- `parent_block_id`: relational tree parent.
- `position`: stable sortable ordering key.
- `depth`: denormalized render helper, not the source of tree ownership.
- `content`: plain text/markdown-ish line content.
- `is_collapsed`: persisted UI state for the block.

Invariant: tree ownership is `parent_block_id`; indentation is derived or denormalized from the tree, never the canonical parent.

### `tasks`

Owns todo semantics.

- `source_block_id`: 1:1 link to the block that displays the task text.
- `status`: `pending | completed | canceled`.
- `due_date`: date used for task views and daily projections.
- `priority`: `low | medium | high`.
- `recurrence`: `weekly | monthly | yearly`.
- `completed_at`: completion timestamp.

Invariant: a task can only exist if its source block exists.

### `block_folder_assignments`

Classifies blocks into folders without moving them out of their original daily document.

Open question: whether the product should allow multiple folders per block or enforce one primary folder to match the current UI.

### `recordings`

Owns transcription lifecycle and generated artifacts.

- `mode`: `meeting | video`.
- `status`: upload/transcription/summary state.
- `document_id` and `anchor_block_id`: where generated content is displayed.
- `transcript` and `summary`: durable source data, not only generated blocks.

Invariant: generated blocks are projections of a recording artifact; the transcript is not recoverable only from rendered note text.

### `calendar_event_links`

Owns provider event identity.

- links to a `task_id` or `block_id`.
- stores provider, external event id, title, start/end, all-day.

Invariant: Google Calendar metadata does not live directly on the text block.

### `agent_conversations` and `agent_messages`

Stores messages as rows, not one JSON array.

Invariant: tool calls and replies should be auditable and queryable by conversation.

## First Grill Decision

The highest-risk decision is whether a top-level daily line should remain just a `block` with children, or whether opening that line as a page should create a separate `document` linked from the block.

Recommendation: start with a block-first model. A block is addressable and can be opened in a focused view that renders its subtree. Create a separate `document` only for surfaces that are naturally independent roots: daily notes, standalone notes, meetings, and videos.

Reason: this keeps "every line is a page" without duplicating hierarchy or moving content between daily and folder surfaces.

