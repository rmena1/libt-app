import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  type AnyPgColumn,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

const nowMs = () => Date.now()

export const documentKind = pgEnum('document_kind', ['daily', 'note', 'meeting', 'video'])
export const recordingMode = pgEnum('recording_mode', ['meeting', 'video'])
export const recordingStatus = pgEnum('recording_status', ['uploading', 'transcribing', 'summarizing', 'completed', 'failed'])
export const taskPriority = pgEnum('task_priority', ['low', 'medium', 'high'])
export const taskStatus = pgEnum('task_status', ['pending', 'completed', 'canceled'])
export const taskRecurrence = pgEnum('task_recurrence', ['weekly', 'monthly', 'yearly'])
export const aiMessageRole = pgEnum('ai_message_role', ['user', 'assistant', 'tool', 'system'])

export const agentModels = pgTable('agent_models', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  modelId: text('model_id').notNull().unique(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
})

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  timezone: text('timezone').notNull().default('America/Santiago'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
})

export const userPreferences = pgTable('user_preferences', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  darkMode: boolean('dark_mode').notNull().default(false),
  agentInstructions: text('agent_instructions'),
  agentMemory: text('agent_memory'),
  selectedAgentModelId: text('selected_agent_model_id').references(() => agentModels.modelId, { onDelete: 'set null' }),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
})

export const userIntegrations = pgTable('user_integrations', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: integer('token_expires_at'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
}, (table) => [
  uniqueIndex('idx_user_integrations_provider').on(table.userId, table.provider),
])

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
}, (table) => [
  index('idx_sessions_user').on(table.userId),
  index('idx_sessions_expires').on(table.expiresAt),
])

export const folders = pgTable('folders', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  parentId: text('parent_id').references((): AnyPgColumn => folders.id, { onDelete: 'cascade' }),
  position: text('position').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
}, (table) => [
  index('idx_folders_user').on(table.userId),
  index('idx_folders_parent').on(table.parentId),
  uniqueIndex('idx_folders_user_slug').on(table.userId, table.slug),
  uniqueIndex('idx_folders_root_position')
    .on(table.userId, table.position)
    .where(sql`${table.parentId} IS NULL`),
  uniqueIndex('idx_folders_child_position')
    .on(table.userId, table.parentId, table.position)
    .where(sql`${table.parentId} IS NOT NULL`),
])

export const documents = pgTable('documents', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: documentKind('kind').notNull(),
  title: text('title'),
  dailyDate: text('daily_date'),
  folderId: text('folder_id').references(() => folders.id, { onDelete: 'set null' }),
  sourceBlockId: text('source_block_id'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
}, (table) => [
  index('idx_documents_user_kind').on(table.userId, table.kind),
  index('idx_documents_user_folder').on(table.userId, table.folderId),
  uniqueIndex('idx_documents_daily_unique')
    .on(table.userId, table.dailyDate)
    .where(sql`${table.kind} = 'daily' AND ${table.dailyDate} IS NOT NULL`),
])

export const blocks = pgTable('blocks', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  parentBlockId: text('parent_block_id').references((): AnyPgColumn => blocks.id, { onDelete: 'cascade' }),
  position: text('position').notNull(),
  depth: integer('depth').notNull().default(0),
  content: text('content').notNull().default(''),
  isCollapsed: boolean('is_collapsed').notNull().default(false),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
}, (table) => [
  index('idx_blocks_user_document').on(table.userId, table.documentId),
  index('idx_blocks_parent').on(table.parentBlockId),
  index('idx_blocks_updated').on(table.userId, table.updatedAt),
  uniqueIndex('idx_blocks_root_position')
    .on(table.documentId, table.position)
    .where(sql`${table.parentBlockId} IS NULL`),
  uniqueIndex('idx_blocks_child_position')
    .on(table.documentId, table.parentBlockId, table.position)
    .where(sql`${table.parentBlockId} IS NOT NULL`),
])

export const blockFolderAssignments = pgTable('block_folder_assignments', {
  blockId: text('block_id').notNull().references(() => blocks.id, { onDelete: 'cascade' }),
  folderId: text('folder_id').notNull().references(() => folders.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
}, (table) => [
  primaryKey({ columns: [table.blockId, table.folderId] }),
  index('idx_block_folder_assignments_user_folder').on(table.userId, table.folderId),
])

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sourceBlockId: text('source_block_id').notNull().references(() => blocks.id, { onDelete: 'cascade' }),
  status: taskStatus('status').notNull().default('pending'),
  dueDate: text('due_date'),
  priority: taskPriority('priority'),
  recurrence: taskRecurrence('recurrence'),
  completedAt: bigint('completed_at', { mode: 'number' }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
}, (table) => [
  uniqueIndex('idx_tasks_source_block').on(table.sourceBlockId),
  index('idx_tasks_user_status_due').on(table.userId, table.status, table.dueDate),
  index('idx_tasks_user_due').on(table.userId, table.dueDate),
])

export const calendarEventLinks = pgTable('calendar_event_links', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  blockId: text('block_id').references(() => blocks.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull().default('google'),
  providerEventId: text('provider_event_id').notNull(),
  title: text('title'),
  startsAt: text('starts_at'),
  endsAt: text('ends_at'),
  allDay: boolean('all_day').notNull().default(false),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
}, (table) => [
  uniqueIndex('idx_calendar_event_provider_id').on(table.userId, table.provider, table.providerEventId),
  index('idx_calendar_event_task').on(table.taskId),
  index('idx_calendar_event_block').on(table.blockId),
  check('calendar_event_links_target_check', sql`${table.taskId} IS NOT NULL OR ${table.blockId} IS NOT NULL`),
])

export const recordings = pgTable('recordings', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  documentId: text('document_id').references(() => documents.id, { onDelete: 'set null' }),
  anchorBlockId: text('anchor_block_id').references(() => blocks.id, { onDelete: 'set null' }),
  mode: recordingMode('mode').notNull(),
  status: recordingStatus('status').notNull().default('uploading'),
  startedAt: bigint('started_at', { mode: 'number' }),
  completedAt: bigint('completed_at', { mode: 'number' }),
  transcript: text('transcript'),
  summary: jsonb('summary'),
  error: text('error'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
}, (table) => [
  index('idx_recordings_user_status').on(table.userId, table.status),
  index('idx_recordings_document').on(table.documentId),
])

export const dailyReviewStates = pgTable('daily_review_states', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  lastActivityAt: bigint('last_activity_at', { mode: 'number' }),
  lastReviewedAt: bigint('last_reviewed_at', { mode: 'number' }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
}, (table) => [
  index('idx_daily_review_states_user_date').on(table.userId, table.date),
  uniqueIndex('idx_daily_review_states_user_date_unique').on(table.userId, table.date),
])

export const dailyReviewActivityQueue = pgTable('daily_review_activity_queue', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  lastActivityAt: bigint('last_activity_at', { mode: 'number' }).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
}, (table) => [
  uniqueIndex('idx_daily_review_activity_queue_user_date').on(table.userId, table.date),
  index('idx_daily_review_activity_queue_updated').on(table.updatedAt),
])

export const agentConversations = pgTable('agent_conversations', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title'),
  context: jsonb('context'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
}, (table) => [
  index('idx_agent_conversations_user').on(table.userId),
  index('idx_agent_conversations_updated').on(table.userId, table.updatedAt),
])

export const agentMessages = pgTable('agent_messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => agentConversations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: aiMessageRole('role').notNull(),
  content: text('content').notNull(),
  toolName: text('tool_name'),
  toolPayload: jsonb('tool_payload'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
}, (table) => [
  index('idx_agent_messages_conversation').on(table.conversationId, table.createdAt),
])

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Folder = typeof folders.$inferSelect
export type NewFolder = typeof folders.$inferInsert
export type Document = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert
export type Block = typeof blocks.$inferSelect
export type NewBlock = typeof blocks.$inferInsert
export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
