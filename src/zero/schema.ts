import {
  table,
  string,
  number,
  boolean,
  createSchema,
  createBuilder,
  relationships,
  definePermissions,
  ANYONE_CAN_DO_ANYTHING,
} from '@rocicorp/zero'

const block = table('block')
  .from('blocks')
  .columns({
    id: string(),
    userId: string().from('user_id'),
    kind: string(),
    parentBlockId: string().optional().from('parent_block_id'),
    dailyBlockId: string().from('daily_block_id'),
    position: string(),
    content: string(),
    isCollapsed: boolean().from('is_collapsed'),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('id')

const dailyBlock = table('dailyBlock')
  .from('daily_blocks')
  .columns({
    blockId: string().from('block_id'),
    userId: string().from('user_id'),
    date: string(),
    createdAt: number().from('created_at'),
  })
  .primaryKey('blockId')

const todoBlock = table('todoBlock')
  .from('todo_blocks')
  .columns({
    blockId: string().from('block_id'),
    userId: string().from('user_id'),
    status: string(),
    dueTime: string().optional().from('due_time'),
    priority: string().optional(),
    recurrence: string().optional(),
    recurrenceParentId: string().optional().from('recurrence_parent_id'),
    completedAt: number().optional().from('completed_at'),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('blockId')

const folder = table('folder')
  .from('folders')
  .columns({
    id: string(),
    userId: string().from('user_id'),
    name: string(),
    slug: string(),
    path: string(),
    parentFolderId: string().optional().from('parent_folder_id'),
    position: string(),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('id')

const blockFolderAssignment = table('blockFolderAssignment')
  .from('block_folder_assignments')
  .columns({
    blockId: string().from('block_id'),
    folderId: string().from('folder_id'),
    userId: string().from('user_id'),
    createdAt: number().from('created_at'),
  })
  .primaryKey('blockId', 'folderId')

const calendarEventLink = table('calendarEventLink')
  .from('calendar_event_links')
  .columns({
    id: string(),
    userId: string().from('user_id'),
    blockId: string().from('block_id'),
    provider: string(),
    providerEventId: string().from('provider_event_id'),
    syncedTitle: string().optional().from('synced_title'),
    syncedStartsAt: string().optional().from('synced_starts_at'),
    syncedEndsAt: string().optional().from('synced_ends_at'),
    lastSyncedAt: number().optional().from('last_synced_at'),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('id')

const dailyReviewState = table('dailyReviewState')
  .from('daily_review_states')
  .columns({
    id: string(),
    userId: string().from('user_id'),
    date: string(),
    lastActivityAt: number().optional().from('last_activity_at'),
    lastReviewedAt: number().optional().from('last_reviewed_at'),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('id')

const blockRelationships = relationships(block, ({ one, many }) => ({
  parentBlock: one({
    sourceField: ['parentBlockId'],
    destSchema: block,
    destField: ['id'],
  }),
  dailyRoot: one({
    sourceField: ['dailyBlockId'],
    destSchema: block,
    destField: ['id'],
  }),
  dailyMetadata: one({
    sourceField: ['id'],
    destSchema: dailyBlock,
    destField: ['blockId'],
  }),
  todoMetadata: one({
    sourceField: ['id'],
    destSchema: todoBlock,
    destField: ['blockId'],
  }),
  childBlocks: many({
    sourceField: ['id'],
    destSchema: block,
    destField: ['parentBlockId'],
  }),
  folderAssignments: many({
    sourceField: ['id'],
    destSchema: blockFolderAssignment,
    destField: ['blockId'],
  }),
  calendarLinks: many({
    sourceField: ['id'],
    destSchema: calendarEventLink,
    destField: ['blockId'],
  }),
}))

const dailyBlockRelationships = relationships(dailyBlock, ({ one }) => ({
  block: one({
    sourceField: ['blockId'],
    destSchema: block,
    destField: ['id'],
  }),
}))

const todoBlockRelationships = relationships(todoBlock, ({ one }) => ({
  block: one({
    sourceField: ['blockId'],
    destSchema: block,
    destField: ['id'],
  }),
  recurrenceParent: one({
    sourceField: ['recurrenceParentId'],
    destSchema: todoBlock,
    destField: ['blockId'],
  }),
}))

const folderRelationships = relationships(folder, ({ one, many }) => ({
  parentFolder: one({
    sourceField: ['parentFolderId'],
    destSchema: folder,
    destField: ['id'],
  }),
  childFolders: many({
    sourceField: ['id'],
    destSchema: folder,
    destField: ['parentFolderId'],
  }),
  assignedBlocks: many({
    sourceField: ['id'],
    destSchema: blockFolderAssignment,
    destField: ['folderId'],
  }),
}))

const blockFolderAssignmentRelationships = relationships(blockFolderAssignment, ({ one }) => ({
  block: one({
    sourceField: ['blockId'],
    destSchema: block,
    destField: ['id'],
  }),
  folder: one({
    sourceField: ['folderId'],
    destSchema: folder,
    destField: ['id'],
  }),
}))

const calendarEventLinkRelationships = relationships(calendarEventLink, ({ one }) => ({
  block: one({
    sourceField: ['blockId'],
    destSchema: block,
    destField: ['id'],
  }),
}))

export const schema = createSchema({
  tables: [block, dailyBlock, todoBlock, folder, blockFolderAssignment, calendarEventLink, dailyReviewState],
  relationships: [
    blockRelationships,
    dailyBlockRelationships,
    todoBlockRelationships,
    folderRelationships,
    blockFolderAssignmentRelationships,
    calendarEventLinkRelationships,
  ],
  enableLegacyQueries: true,
  enableLegacyMutators: true,
})

export const zql = createBuilder(schema)

export type Schema = typeof schema

export const permissions = definePermissions<unknown, Schema>(schema, () => ({
  block: ANYONE_CAN_DO_ANYTHING,
  dailyBlock: ANYONE_CAN_DO_ANYTHING,
  todoBlock: ANYONE_CAN_DO_ANYTHING,
  folder: ANYONE_CAN_DO_ANYTHING,
  blockFolderAssignment: ANYONE_CAN_DO_ANYTHING,
  calendarEventLink: ANYONE_CAN_DO_ANYTHING,
  dailyReviewState: ANYONE_CAN_DO_ANYTHING,
}))

declare module '@rocicorp/zero' {
  interface DefaultTypes {
    schema: Schema
  }
}
