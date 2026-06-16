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
A root block representing one calendar day for a user. It owns the daily note tree for that date.
_Avoid_: Daily page, daily document

**Todo Block**:
A block that represents a todo item in the UI. Todo state such as status, due date, priority, recurrence, and completion timestamp is metadata attached 1:1 to the block, not nullable fields on every block.
_Avoid_: Task page

**Folder**:
A hierarchical tag assigned to blocks for filtered navigation. Folders organize views over blocks; they do not own block content or move blocks out of their original tree.
_Avoid_: Container, location

**Folder Assignment**:
A direct tag from one folder to one block. The assignment applies only to that block; folder views may show the block's descendant tree as context, but descendants are not implicitly tagged.
_Avoid_: Recursive folder membership, inherited folder

**Special View**:
A derived view that shows blocks matching a filter, such as todos grouped by date/priority or blocks tagged with a folder. A special view is not a separate source of truth.
_Avoid_: Section as owner, duplicated list

## Example Dialogue

Developer: "When I open a todo from the todos view, what am I opening?"

Domain Expert: "You are opening the todo block. The todos view only filtered it; the block still lives in its original tree."

Developer: "If I tag a meeting summary with a folder, does it move?"

Domain Expert: "No. The folder is a tag. The folder view shows that block and can let me open its subtree, but the original daily tree remains the source of truth."

Developer: "If I tag a parent block, are all children tagged too?"

Domain Expert: "No. Only the parent has the folder assignment. The folder view can render the children under it for context."
