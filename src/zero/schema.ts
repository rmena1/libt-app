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

const document = table('document')
  .from('documents')
  .columns({
    id: string(),
    userId: string().from('user_id'),
    kind: string(),
    title: string().optional(),
    dailyDate: string().optional().from('daily_date'),
    folderId: string().optional().from('folder_id'),
    sourceBlockId: string().optional().from('source_block_id'),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('id')

const block = table('block')
  .from('blocks')
  .columns({
    id: string(),
    userId: string().from('user_id'),
    documentId: string().from('document_id'),
    parentBlockId: string().optional().from('parent_block_id'),
    position: string(),
    depth: number(),
    content: string(),
    isCollapsed: boolean().from('is_collapsed'),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('id')

const folder = table('folder')
  .from('folders')
  .columns({
    id: string(),
    userId: string().from('user_id'),
    name: string(),
    slug: string(),
    parentId: string().optional().from('parent_id'),
    position: string(),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('id')

const task = table('task')
  .from('tasks')
  .columns({
    id: string(),
    userId: string().from('user_id'),
    sourceBlockId: string().from('source_block_id'),
    status: string(),
    dueDate: string().optional().from('due_date'),
    priority: string().optional(),
    recurrence: string().optional(),
    completedAt: number().optional().from('completed_at'),
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

const documentRelationships = relationships(document, ({ many, one }) => ({
  blocks: many({
    sourceField: ['id'],
    destSchema: block,
    destField: ['documentId'],
  }),
  folder: one({
    sourceField: ['folderId'],
    destSchema: folder,
    destField: ['id'],
  }),
}))

const blockRelationships = relationships(block, ({ one, many }) => ({
  document: one({
    sourceField: ['documentId'],
    destSchema: document,
    destField: ['id'],
  }),
  parentBlock: one({
    sourceField: ['parentBlockId'],
    destSchema: block,
    destField: ['id'],
  }),
  childBlocks: many({
    sourceField: ['id'],
    destSchema: block,
    destField: ['parentBlockId'],
  }),
  task: one({
    sourceField: ['id'],
    destSchema: task,
    destField: ['sourceBlockId'],
  }),
  folderAssignments: many({
    sourceField: ['id'],
    destSchema: blockFolderAssignment,
    destField: ['blockId'],
  }),
}))

const folderRelationships = relationships(folder, ({ one, many }) => ({
  parentFolder: one({
    sourceField: ['parentId'],
    destSchema: folder,
    destField: ['id'],
  }),
  childFolders: many({
    sourceField: ['id'],
    destSchema: folder,
    destField: ['parentId'],
  }),
  documents: many({
    sourceField: ['id'],
    destSchema: document,
    destField: ['folderId'],
  }),
  assignedBlocks: many({
    sourceField: ['id'],
    destSchema: blockFolderAssignment,
    destField: ['folderId'],
  }),
}))

const taskRelationships = relationships(task, ({ one }) => ({
  sourceBlock: one({
    sourceField: ['sourceBlockId'],
    destSchema: block,
    destField: ['id'],
  }),
}))

export const schema = createSchema({
  tables: [document, block, folder, task, blockFolderAssignment, dailyReviewState],
  relationships: [documentRelationships, blockRelationships, folderRelationships, taskRelationships],
  enableLegacyQueries: true,
  enableLegacyMutators: true,
})

export const zql = createBuilder(schema)

export type Schema = typeof schema

export const permissions = definePermissions<unknown, Schema>(schema, () => ({
  document: ANYONE_CAN_DO_ANYTHING,
  block: ANYONE_CAN_DO_ANYTHING,
  folder: ANYONE_CAN_DO_ANYTHING,
  task: ANYONE_CAN_DO_ANYTHING,
  blockFolderAssignment: ANYONE_CAN_DO_ANYTHING,
  dailyReviewState: ANYONE_CAN_DO_ANYTHING,
}))

declare module '@rocicorp/zero' {
  interface DefaultTypes {
    schema: Schema
  }
}

