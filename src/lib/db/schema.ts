import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  type AnyPgColumn,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

const nowMs = () => Date.now()

export const blockKind = pgEnum('block_kind', ['daily', 'text', 'todo'])
export const todoPriority = pgEnum('todo_priority', ['low', 'medium', 'high'])
export const todoRecurrence = pgEnum('todo_recurrence', ['weekly', 'monthly', 'yearly'])
export const todoStatus = pgEnum('todo_status', ['pending', 'completed', 'canceled'])
export const aiMessageRole = pgEnum('ai_message_role', ['user', 'assistant', 'tool', 'system'])
export const meetingRecordingMode = pgEnum('meeting_recording_mode', ['mic', 'meeting', 'video', 'file'])
export const meetingRecordingStatus = pgEnum('meeting_recording_status', ['processing', 'completed', 'failed'])
export const audioBackupStatus = pgEnum('audio_backup_status', ['archived', 'transcribed', 'transcription_failed'])
export const recordingUploadStatus = pgEnum('recording_upload_status', ['uploading', 'processing', 'completed', 'failed'])

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
  isActive: boolean('is_active').notNull().default(false),
  timezone: text('timezone').notNull().default('America/Santiago'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
})

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
}, (table) => [
  index('idx_sessions_user').on(table.userId),
  index('idx_sessions_expires').on(table.expiresAt),
])

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

export const blocks = pgTable('blocks', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: blockKind('kind').notNull(),
  parentBlockId: text('parent_block_id'),
  dailyBlockId: text('daily_block_id').notNull(),
  position: text('position').notNull(),
  content: text('content').notNull().default(''),
  isCollapsed: boolean('is_collapsed').notNull().default(false),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
}, (table) => [
  unique('blocks_id_user_id_unique').on(table.id, table.userId),
  index('idx_blocks_user_daily').on(table.userId, table.dailyBlockId),
  index('idx_blocks_user_kind').on(table.userId, table.kind),
  index('idx_blocks_parent').on(table.parentBlockId, table.position),
  index('idx_blocks_updated').on(table.userId, table.updatedAt),
  uniqueIndex('idx_blocks_child_position')
    .on(table.parentBlockId, table.position)
    .where(sql`${table.parentBlockId} IS NOT NULL`),
  check(
    'blocks_root_shape_check',
    sql`(
      ${table.kind} = 'daily'
      AND ${table.parentBlockId} IS NULL
      AND ${table.dailyBlockId} = ${table.id}
    ) OR (
      ${table.kind} <> 'daily'
      AND ${table.parentBlockId} IS NOT NULL
    )`,
  ),
  foreignKey({
    name: 'blocks_parent_same_user_fk',
    columns: [table.parentBlockId, table.userId],
    foreignColumns: [table.id, table.userId],
  }).onDelete('cascade'),
  foreignKey({
    name: 'blocks_daily_same_user_fk',
    columns: [table.dailyBlockId, table.userId],
    foreignColumns: [table.id, table.userId],
  }).onDelete('cascade'),
])

export const dailyBlocks = pgTable('daily_blocks', {
  blockId: text('block_id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
}, (table) => [
  uniqueIndex('idx_daily_blocks_user_date').on(table.userId, table.date),
  check('daily_blocks_date_check', sql`${table.date} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`),
  foreignKey({
    name: 'daily_blocks_block_same_user_fk',
    columns: [table.blockId, table.userId],
    foreignColumns: [blocks.id, blocks.userId],
  }).onDelete('cascade'),
])

export const todoBlocks = pgTable('todo_blocks', {
  blockId: text('block_id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: todoStatus('status').notNull().default('pending'),
  dueTime: text('due_time'),
  priority: todoPriority('priority'),
  recurrence: todoRecurrence('recurrence'),
  recurrenceParentId: text('recurrence_parent_id').references((): AnyPgColumn => todoBlocks.blockId, { onDelete: 'set null' }),
  completedAt: bigint('completed_at', { mode: 'number' }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
}, (table) => [
  unique('todo_blocks_block_id_user_id_unique').on(table.blockId, table.userId),
  index('idx_todo_blocks_user_status').on(table.userId, table.status),
  index('idx_todo_blocks_user_priority').on(table.userId, table.priority),
  index('idx_todo_blocks_recurrence_parent').on(table.recurrenceParentId),
  check('todo_blocks_due_time_check', sql`${table.dueTime} IS NULL OR ${table.dueTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
  foreignKey({
    name: 'todo_blocks_block_same_user_fk',
    columns: [table.blockId, table.userId],
    foreignColumns: [blocks.id, blocks.userId],
  }).onDelete('cascade'),
])

export const folders = pgTable('folders', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  path: text('path').notNull(),
  parentFolderId: text('parent_folder_id'),
  position: text('position').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
}, (table) => [
  unique('folders_id_user_id_unique').on(table.id, table.userId),
  index('idx_folders_user').on(table.userId),
  index('idx_folders_parent').on(table.parentFolderId),
  uniqueIndex('idx_folders_user_path').on(table.userId, table.path),
  uniqueIndex('idx_folders_root_slug')
    .on(table.userId, table.slug)
    .where(sql`${table.parentFolderId} IS NULL`),
  uniqueIndex('idx_folders_child_slug')
    .on(table.userId, table.parentFolderId, table.slug)
    .where(sql`${table.parentFolderId} IS NOT NULL`),
  uniqueIndex('idx_folders_root_position')
    .on(table.userId, table.position)
    .where(sql`${table.parentFolderId} IS NULL`),
  uniqueIndex('idx_folders_child_position')
    .on(table.userId, table.parentFolderId, table.position)
    .where(sql`${table.parentFolderId} IS NOT NULL`),
  foreignKey({
    name: 'folders_parent_same_user_fk',
    columns: [table.parentFolderId, table.userId],
    foreignColumns: [table.id, table.userId],
  }).onDelete('cascade'),
])

export const blockFolderAssignments = pgTable('block_folder_assignments', {
  blockId: text('block_id').notNull(),
  folderId: text('folder_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
}, (table) => [
  primaryKey({ columns: [table.blockId, table.folderId] }),
  index('idx_block_folder_assignments_user_folder').on(table.userId, table.folderId),
  index('idx_block_folder_assignments_user_block').on(table.userId, table.blockId),
  foreignKey({
    name: 'block_folder_assignments_block_same_user_fk',
    columns: [table.blockId, table.userId],
    foreignColumns: [blocks.id, blocks.userId],
  }).onDelete('cascade'),
  foreignKey({
    name: 'block_folder_assignments_folder_same_user_fk',
    columns: [table.folderId, table.userId],
    foreignColumns: [folders.id, folders.userId],
  }).onDelete('cascade'),
])

export const calendarEventLinks = pgTable('calendar_event_links', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  blockId: text('block_id').notNull(),
  provider: text('provider').notNull().default('google'),
  providerEventId: text('provider_event_id').notNull(),
  syncedTitle: text('synced_title'),
  syncedStartsAt: text('synced_starts_at'),
  syncedEndsAt: text('synced_ends_at'),
  lastSyncedAt: bigint('last_synced_at', { mode: 'number' }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
}, (table) => [
  uniqueIndex('idx_calendar_event_links_provider_event').on(table.userId, table.provider, table.providerEventId),
  uniqueIndex('idx_calendar_event_links_block_provider').on(table.blockId, table.provider),
  index('idx_calendar_event_links_user_block').on(table.userId, table.blockId),
  foreignKey({
    name: 'calendar_event_links_block_same_user_fk',
    columns: [table.blockId, table.userId],
    foreignColumns: [blocks.id, blocks.userId],
  }).onDelete('cascade'),
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

export type MeetingSummaryPayload = {
  titulo: string
  puntos_clave: string[]
  decisiones: string[]
  datos_clave: string[]
  accionables: string[]
  temas_abiertos: string[]
  contexto: string
  resumen: string
}

export type VideoSummaryPayload = {
  titulo: string
  resumen_corto: string
  resumen_completo: string
  puntos_clave: string[]
}

export const meetingRecordings = pgTable('meeting_recordings', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mode: meetingRecordingMode('mode').notNull(),
  status: meetingRecordingStatus('status').notNull().default('processing'),
  dailyDate: text('daily_date').notNull(),
  startedAtTime: text('started_at_time'),
  title: text('title'),
  transcript: text('transcript'),
  summary: jsonb('summary').$type<MeetingSummaryPayload | VideoSummaryPayload>(),
  errorMessage: text('error_message'),
  visibleBlockId: text('visible_block_id').references(() => blocks.id, { onDelete: 'set null' }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
}, (table) => [
  unique('meeting_recordings_id_user_id_unique').on(table.id, table.userId),
  index('idx_meeting_recordings_user_created').on(table.userId, table.createdAt),
  index('idx_meeting_recordings_user_status').on(table.userId, table.status),
  check('meeting_recordings_daily_date_check', sql`${table.dailyDate} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`),
  check('meeting_recordings_started_at_time_check', sql`${table.startedAtTime} IS NULL OR ${table.startedAtTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
])

export const audioBackups = pgTable('audio_backups', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  recordingId: text('recording_id'),
  bucketName: text('bucket_name').notNull(),
  objectKey: text('object_key').notNull().unique(),
  originalFileName: text('original_file_name').notNull(),
  contentType: text('content_type'),
  sizeBytes: integer('size_bytes').notNull(),
  source: meetingRecordingMode('source').notNull(),
  status: audioBackupStatus('status').notNull().default('archived'),
  errorMessage: text('error_message'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
}, (table) => [
  index('idx_audio_backups_user_created').on(table.userId, table.createdAt),
  index('idx_audio_backups_recording').on(table.recordingId),
  foreignKey({
    name: 'audio_backups_recording_same_user_fk',
    columns: [table.recordingId, table.userId],
    foreignColumns: [meetingRecordings.id, meetingRecordings.userId],
  }).onDelete('cascade'),
])

export const recordingUploadSessions = pgTable('recording_upload_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  recordingId: text('recording_id').notNull(),
  status: recordingUploadStatus('status').notNull().default('uploading'),
  mode: meetingRecordingMode('mode').notNull(),
  dailyDate: text('daily_date').notNull(),
  startedAtTime: text('started_at_time'),
  totalChunks: integer('total_chunks').notNull(),
  uploadedChunks: integer('uploaded_chunks').notNull().default(0),
  sizeBytes: integer('size_bytes').notNull().default(0),
  originalFileName: text('original_file_name'),
  contentType: text('content_type'),
  errorMessage: text('error_message'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
}, (table) => [
  index('idx_recording_upload_sessions_user_created').on(table.userId, table.createdAt),
  index('idx_recording_upload_sessions_recording').on(table.recordingId),
  check('recording_upload_sessions_total_chunks_check', sql`${table.totalChunks} > 0`),
  check('recording_upload_sessions_uploaded_chunks_check', sql`${table.uploadedChunks} >= 0 AND ${table.uploadedChunks} <= ${table.totalChunks}`),
  check('recording_upload_sessions_size_bytes_check', sql`${table.sizeBytes} >= 0`),
  check('recording_upload_sessions_daily_date_check', sql`${table.dailyDate} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`),
  check('recording_upload_sessions_started_at_time_check', sql`${table.startedAtTime} IS NULL OR ${table.startedAtTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
  foreignKey({
    name: 'recording_upload_sessions_recording_same_user_fk',
    columns: [table.recordingId, table.userId],
    foreignColumns: [meetingRecordings.id, meetingRecordings.userId],
  }).onDelete('cascade'),
])

export const agentConversations = pgTable('agent_conversations', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title'),
  context: jsonb('context'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
}, (table) => [
  unique('agent_conversations_id_user_id_unique').on(table.id, table.userId),
  index('idx_agent_conversations_user').on(table.userId),
  index('idx_agent_conversations_updated').on(table.userId, table.updatedAt),
])

export const agentMessages = pgTable('agent_messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: aiMessageRole('role').notNull(),
  content: text('content').notNull(),
  toolName: text('tool_name'),
  toolPayload: jsonb('tool_payload'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(nowMs),
}, (table) => [
  index('idx_agent_messages_conversation').on(table.conversationId, table.createdAt),
  foreignKey({
    name: 'agent_messages_conversation_same_user_fk',
    columns: [table.conversationId, table.userId],
    foreignColumns: [agentConversations.id, agentConversations.userId],
  }).onDelete('cascade'),
])

export type AgentModel = typeof agentModels.$inferSelect
export type NewAgentModel = typeof agentModels.$inferInsert
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type Block = typeof blocks.$inferSelect
export type NewBlock = typeof blocks.$inferInsert
export type DailyBlock = typeof dailyBlocks.$inferSelect
export type NewDailyBlock = typeof dailyBlocks.$inferInsert
export type TodoBlock = typeof todoBlocks.$inferSelect
export type NewTodoBlock = typeof todoBlocks.$inferInsert
export type Folder = typeof folders.$inferSelect
export type NewFolder = typeof folders.$inferInsert
export type BlockFolderAssignment = typeof blockFolderAssignments.$inferSelect
export type NewBlockFolderAssignment = typeof blockFolderAssignments.$inferInsert
export type CalendarEventLink = typeof calendarEventLinks.$inferSelect
export type NewCalendarEventLink = typeof calendarEventLinks.$inferInsert
export type MeetingRecording = typeof meetingRecordings.$inferSelect
export type NewMeetingRecording = typeof meetingRecordings.$inferInsert
export type AudioBackup = typeof audioBackups.$inferSelect
export type NewAudioBackup = typeof audioBackups.$inferInsert
export type RecordingUploadSession = typeof recordingUploadSessions.$inferSelect
export type NewRecordingUploadSession = typeof recordingUploadSessions.$inferInsert
