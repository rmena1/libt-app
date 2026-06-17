# libt

libt is a personal knowledge app where every user-authored item is a block. The model avoids page/document terminology unless a future integration requires an external export format.

## Language

**Block**:
The canonical unit of user-authored content. A block may contain child blocks, and opening any block shows that block and its descendant tree.
_Avoid_: Page, document, line as a separate domain concept

**Block Kind**:
The visible role of a block in the product. The initial kinds are daily, text, and todo.
_Avoid_: Separate page types

**Text Block**:
A basic block whose content is ordinary note text. Meeting and video transcriptions are stored as text blocks unless a future feature needs a separate recording artifact.
_Avoid_: Note page, meeting page

**Daily Block**:
A root block representing one calendar day for a user. Daily blocks are the only root blocks; every other block belongs to exactly one daily block through its parent chain.
_Avoid_: Daily page, daily document

**Daily Block Creation**:
Daily blocks are created lazily only when an operation needs to insert or move a child block to that date. Scrolling, focusing, or rendering a date shell in the daily timeline must not create a daily block. Creation is idempotent per user and date.
_Avoid_: Precreated empty days, viewport-driven daily block creation

**Daily Timeline Shell**:
A client-side representation of a calendar date in the daily timeline when no persisted daily block exists for that date. Shells let the UI scroll through all dates and request persisted daily blocks by date range without writing empty records.
_Avoid_: Empty persisted daily block, placeholder row

**Daily Timeline Virtualization**:
The daily timeline must support unbounded navigation through past and future dates while keeping only a bounded date window mounted around the viewport. Persisted daily blocks are fetched by date range for that window, and empty dates are rendered as client-side shells.
_Avoid_: Expand-only mounted date ranges, retaining every visited day in the DOM

**Focused Date**:
The date currently selected by the app shell while viewing the daily timeline. It is derived from the visible timeline position, not persisted in the database. Calendar clicks navigate the timeline; after navigation, the focused date is again derived from the viewport.
_Avoid_: Calendar-owned selected date, persisted viewport focus, duplicated focus state

**Responsive App Shell**:
The desktop app shell uses left navigation, central content, and a right contextual sidebar. The mobile app shell does not use sidebars or drawer versions of those sidebars; it uses the mobile navigation and contextual controls defined by the app's mobile interaction model.
_Avoid_: Mobile sidebars, compressed desktop layout on small screens

**Mobile Daily Shell**:
On mobile, daily navigation uses a bottom navigation bar for the primary sections, a sticky horizontal date timeline at the top of the daily view, and a floating top-right AI button that opens the assistant as a dedicated overlay/screen. The mobile shell should follow the proven conceptual structure from the existing libt app while reimplementing behavior cleanly.
_Avoid_: Desktop sidebars on mobile, hidden calendar drawer, AI inside a right sidebar on mobile

**Shell vs Feature Surface**:
The app shell may expose navigation and contextual surfaces before their full feature behavior exists. Shell elements must not create alternate data ownership; they either navigate to implemented views or render explicit placeholders until their feature module is implemented.
_Avoid_: Fake local-only feature state, sidebar-owned block data

**Daily View First Cut**:
The first complete daily view implementation includes virtualized infinite date navigation, persisted daily block range fetching, empty day shells, text block creation/editing, enter-to-create-next-block, indent/outdent tree operations, todo conversion/completion, drag-and-drop before/after/child movement across blocks and days, focused-date synchronization, and date navigation from desktop calendar and mobile timeline. Later features such as recurrence, external calendar sync, meeting transcription, real AI behavior, folders, favorites, global search, and daily review build on this foundation.
_Avoid_: Shipping daily UI without end-to-end block operations, mixing future feature ownership into the daily foundation

**Daily Block Membership**:
A maintained structural reference from every block to its ancestor daily block. It exists to make special views and sync queries efficient; the visible date still comes from the daily block metadata.
_Avoid_: Independent block date, recursive date lookup as the primary query contract

**Block Date**:
The date of a non-root block is derived from its ancestor daily block. Notes and todos do not own independent dates while they remain inside a daily tree.
_Avoid_: Per-block note date

**Cross-Day Block Movement**:
Moving a block to another day moves the block and its entire descendant tree under the target daily block. The move changes the canonical date for the whole subtree by updating its daily block membership projection, while preserving block metadata such as folder assignments, todo state, priority, and due time.
_Avoid_: Copying blocks between days, per-child date overrides, date change without tree movement

**Block Drop Target**:
Drag and drop over a block tree must resolve to an explicit tree operation: insert before a sibling, insert after a sibling, or insert as a child. The UI must show the resolved target while dragging: a line between blocks for sibling insertion, or a full-block border/highlight for child insertion.
_Avoid_: Ambiguous drop behavior, invisible inferred targets

**Collapsed Drop Expansion**:
When dragging over a collapsed block as a child drop target, holding the drag over that block for 2 seconds expands it so the user can drop inside its subtree.
_Avoid_: Forcing drops into hidden content, requiring a separate expand action during drag

**Todo Block**:
A block that represents a todo item in the UI. Todo state such as status, due time, priority, recurrence, and completion timestamp is metadata attached 1:1 to the block, not nullable fields on every block.
_Avoid_: Task page

**Todo Rescheduling**:
Changing a todo's date moves the todo block and its entire descendant tree directly under the daily block for the selected date, appended after the existing direct children. If the todo was inside another note subtree, it leaves that subtree and stops appearing there.
_Avoid_: Projected due date without movement, implicit todos section

**Todo Due Time**:
An optional local time-of-day attached to a todo block. The todo's due date is still derived from its ancestor daily block; together, the daily block date and todo due time define when the todo is due.
_Avoid_: Duplicated due date

**Recurring Todo**:
A todo block with a recurrence rule. Completing a recurring todo keeps the current todo completed and creates a new todo block for the next occurrence under the future daily block. The new occurrence copies only the todo block's own content and todo metadata, not its descendants or external assignments.
_Avoid_: Reopening the same todo, moving the same recurring block forward

**Calendar Event Link**:
A link between a todo block and an external calendar event. The todo block owns the link; rescheduling the todo or changing its due time updates the existing external event instead of creating a new one.
_Avoid_: Calendar event as todo source of truth, date-only calendar link

**Folder**:
A hierarchical tag assigned to blocks for filtered navigation. Folders organize views over blocks; they do not own block content or move blocks out of their original tree.
_Avoid_: Container, location

**Folder Assignment**:
A direct tag from one folder to one block. A block may have multiple folder assignments. Each assignment applies only to that block; folder views may show the block's descendant tree as context, but descendants are not implicitly tagged.
_Avoid_: Recursive folder membership, inherited folder, primary folder

**Folder View**:
A special view for one folder that shows blocks assigned directly to that folder and blocks assigned to descendant folders. Descendant-folder results are aggregated by the view filter; the underlying assignments remain direct tags to their specific folders.
_Avoid_: Ancestor tag materialization

**Special View**:
A derived view that shows blocks matching a filter, such as todos grouped by date/priority or blocks tagged with a folder. A special view is not a separate source of truth.
_Avoid_: Section as owner, duplicated list

**User Admission**:
A registered user must be admitted before they can access the app. New users start inactive and remain blocked until they are explicitly admitted.
_Avoid_: Open signup, automatic activation

**Inactive User**:
A registered user who has not been admitted. An inactive user cannot access authenticated app data or sync endpoints.
_Avoid_: Disabled session as the source of truth

## Example Dialogue

Developer: "When I open a todo from the todos view, what am I opening?"

Domain Expert: "You are opening the todo block. The todos view only filtered it; the block still lives in its original tree."

Developer: "If I create a note directly from a folder, where does it live?"

Domain Expert: "It still lives under today's daily block. The folder assignment only changes where it appears as a filtered result."

Developer: "Do daily blocks exist before anything is written on that date?"

Domain Expert: "No. Scrolling or focusing a day only renders a timeline shell. A daily block is created only when a child block must be inserted or moved to that date."

Developer: "If I scroll through months of days, should all visited days stay mounted?"

Domain Expert: "No. The timeline is virtualized. It keeps a bounded window around the viewport and can fetch real daily blocks for that window."

Developer: "Who decides which day is selected in the calendar?"

Domain Expert: "The daily timeline does. The calendar reflects the timeline's focused date, and calendar clicks ask the timeline to navigate."

Developer: "How do sidebars work on mobile?"

Domain Expert: "They do not become sidebars. Mobile uses bottom navigation, a top horizontal daily timeline, and a floating AI entry point."

Developer: "Can shell navigation exist before the filtered feature is implemented?"

Domain Expert: "Yes, as a shell or explicit placeholder. It must not invent a separate data model or local-only source of truth."

Developer: "What makes the first daily view implementation complete?"

Domain Expert: "It must cover the core block workflow end to end: virtualized days, real range fetching, creating and editing blocks, todo basics, tree indentation, cross-day drag and drop, and date focus/navigation across desktop and mobile."

Developer: "Why does every block store daily block membership if dates are derived?"

Domain Expert: "It is a maintained projection for efficient views. The canonical date still belongs to the daily block."

Developer: "If I tag a meeting summary with a folder, does it move?"

Domain Expert: "No. The folder is a tag. The folder view shows that block and can let me open its subtree, but the original daily tree remains the source of truth."

Developer: "If I reschedule a todo that was inside meeting notes, does it remain in the meeting?"

Domain Expert: "No. Rescheduling moves the todo and all of its children to the target daily block, so it is no longer part of the meeting subtree."

Developer: "Does rescheduling create or use a todos section under the target day?"

Domain Expert: "No. The todo is inserted directly under the target daily block, after the existing direct children. A UI view may group todos visually, but that grouping is not written into the block tree."

Developer: "Where is the due date stored for a todo with a due time?"

Domain Expert: "The date comes from the daily block that contains the todo. The todo only stores its optional due time."

Developer: "When I complete a recurring todo, does the same block move to the next date?"

Domain Expert: "No. The completed todo stays where it happened, and a new todo block is created for the next occurrence."

Developer: "Does the next recurring todo copy subtasks or notes from the completed one?"

Domain Expert: "No. It copies only the todo itself, not its children, folder assignments, or calendar links."

Developer: "If I move a todo with a calendar event to another date, what happens to the event?"

Domain Expert: "The calendar link stays on the todo block, and the existing external event is updated to the todo's new date and due time."

Developer: "If I drag a note with children to another day, what date do the children have?"

Domain Expert: "They move with the parent. The whole subtree now belongs to the target daily block, so every descendant derives the target date."

Developer: "How do I know where a dragged block will land?"

Domain Expert: "The UI shows the exact target. A line means before or after an existing block; a full-block highlight means the dragged block will become a child."

Developer: "If I tag a parent block, are all children tagged too?"

Domain Expert: "No. Only the parent has the folder assignment. The folder view can render the children under it for context."

Developer: "Can a block belong to more than one folder?"

Domain Expert: "Yes. Folders are tags, so a block can have multiple direct folder assignments."

Developer: "When I open a parent folder, should I see blocks from subfolders?"

Domain Expert: "Yes. The parent folder view aggregates descendant folders, but the blocks are still tagged only with the specific folder assigned to them."

Developer: "Can a newly registered user enter the app immediately?"

Domain Expert: "No. Registration creates an inactive user, and app access starts only after user admission."
