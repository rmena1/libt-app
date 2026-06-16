# libt

libt is a personal knowledge app where every user-authored item is a block. The model avoids page/document terminology unless a future integration requires an external export format.

## Language

**Block**:
The canonical unit of user-authored content. A block may contain child blocks, and opening any block shows that block and its descendant tree.
_Avoid_: Page, document, line as a separate domain concept

**Text Block**:
A basic block whose content is ordinary note text. Meeting and video transcriptions are stored as text blocks unless a future feature needs a separate recording artifact.
_Avoid_: Note page, meeting page

**Daily Block**:
A root block representing one calendar day for a user. Daily blocks are the only root blocks; every other block belongs to exactly one daily block through its parent chain.
_Avoid_: Daily page, daily document

**Block Date**:
The date of a non-root block is derived from its ancestor daily block. Notes and todos do not own independent dates while they remain inside a daily tree.
_Avoid_: Per-block note date

**Todo Block**:
A block that represents a todo item in the UI. Todo state such as status, due date, priority, recurrence, and completion timestamp is metadata attached 1:1 to the block, not nullable fields on every block.
_Avoid_: Task page

**Todo Rescheduling**:
Changing a todo's date moves the todo block under the daily block for the selected date. If the todo was inside another note subtree, it leaves that subtree and stops appearing there.
_Avoid_: Projected due date without movement

**Folder**:
A hierarchical tag assigned to blocks for filtered navigation. Folders organize views over blocks; they do not own block content or move blocks out of their original tree.
_Avoid_: Container, location

**Folder Assignment**:
A direct tag from one folder to one block. The assignment applies only to that block; folder views may show the block's descendant tree as context, but descendants are not implicitly tagged.
_Avoid_: Recursive folder membership, inherited folder

**Folder View**:
A special view for one folder that shows blocks assigned directly to that folder and blocks assigned to descendant folders. Descendant-folder results are aggregated by the view filter; the underlying assignments remain direct tags to their specific folders.
_Avoid_: Ancestor tag materialization

**Special View**:
A derived view that shows blocks matching a filter, such as todos grouped by date/priority or blocks tagged with a folder. A special view is not a separate source of truth.
_Avoid_: Section as owner, duplicated list

## Example Dialogue

Developer: "When I open a todo from the todos view, what am I opening?"

Domain Expert: "You are opening the todo block. The todos view only filtered it; the block still lives in its original tree."

Developer: "If I create a note directly from a folder, where does it live?"

Domain Expert: "It still lives under today's daily block. The folder assignment only changes where it appears as a filtered result."

Developer: "If I tag a meeting summary with a folder, does it move?"

Domain Expert: "No. The folder is a tag. The folder view shows that block and can let me open its subtree, but the original daily tree remains the source of truth."

Developer: "If I reschedule a todo that was inside meeting notes, does it remain in the meeting?"

Domain Expert: "No. Rescheduling moves the todo to the target daily block, so it is no longer part of the meeting subtree."

Developer: "If I tag a parent block, are all children tagged too?"

Domain Expert: "No. Only the parent has the folder assignment. The folder view can render the children under it for context."

Developer: "When I open a parent folder, should I see blocks from subfolders?"

Domain Expert: "Yes. The parent folder view aggregates descendant folders, but the blocks are still tagged only with the specific folder assigned to them."
