CREATE TYPE "public"."ai_message_role" AS ENUM('user', 'assistant', 'tool', 'system');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('daily', 'note', 'meeting', 'video');--> statement-breakpoint
CREATE TYPE "public"."recording_mode" AS ENUM('meeting', 'video');--> statement-breakpoint
CREATE TYPE "public"."recording_status" AS ENUM('uploading', 'transcribing', 'summarizing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."task_recurrence" AS ENUM('weekly', 'monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pending', 'completed', 'canceled');--> statement-breakpoint
CREATE TABLE "agent_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text,
	"context" jsonb,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "ai_message_role" NOT NULL,
	"content" text NOT NULL,
	"tool_name" text,
	"tool_payload" jsonb,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_models" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"model_id" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "agent_models_model_id_unique" UNIQUE("model_id")
);
--> statement-breakpoint
CREATE TABLE "block_folder_assignments" (
	"block_id" text NOT NULL,
	"folder_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "block_folder_assignments_block_id_folder_id_pk" PRIMARY KEY("block_id","folder_id")
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"document_id" text NOT NULL,
	"parent_block_id" text,
	"position" text NOT NULL,
	"depth" integer DEFAULT 0 NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"is_collapsed" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_event_links" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"task_id" text,
	"block_id" text,
	"provider" text DEFAULT 'google' NOT NULL,
	"provider_event_id" text NOT NULL,
	"title" text,
	"starts_at" text,
	"ends_at" text,
	"all_day" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "calendar_event_links_target_check" CHECK ("calendar_event_links"."task_id" IS NOT NULL OR "calendar_event_links"."block_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "daily_review_activity_queue" (
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"last_activity_at" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_review_states" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"last_activity_at" bigint,
	"last_reviewed_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" "document_kind" NOT NULL,
	"title" text,
	"daily_date" text,
	"folder_id" text,
	"source_block_id" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"parent_id" text,
	"position" text NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recordings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"document_id" text,
	"anchor_block_id" text,
	"mode" "recording_mode" NOT NULL,
	"status" "recording_status" DEFAULT 'uploading' NOT NULL,
	"started_at" bigint,
	"completed_at" bigint,
	"transcript" text,
	"summary" jsonb,
	"error" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" bigint NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source_block_id" text NOT NULL,
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"due_date" text,
	"priority" "task_priority",
	"recurrence" "task_recurrence",
	"completed_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" integer,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"dark_mode" boolean DEFAULT false NOT NULL,
	"agent_instructions" text,
	"agent_memory" text,
	"selected_agent_model_id" text,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"timezone" text DEFAULT 'America/Santiago' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "agent_conversations" ADD CONSTRAINT "agent_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_conversation_id_agent_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."agent_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_folder_assignments" ADD CONSTRAINT "block_folder_assignments_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_folder_assignments" ADD CONSTRAINT "block_folder_assignments_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_folder_assignments" ADD CONSTRAINT "block_folder_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_parent_block_id_blocks_id_fk" FOREIGN KEY ("parent_block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_links" ADD CONSTRAINT "calendar_event_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_links" ADD CONSTRAINT "calendar_event_links_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_links" ADD CONSTRAINT "calendar_event_links_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_review_activity_queue" ADD CONSTRAINT "daily_review_activity_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_review_states" ADD CONSTRAINT "daily_review_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_anchor_block_id_blocks_id_fk" FOREIGN KEY ("anchor_block_id") REFERENCES "public"."blocks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_source_block_id_blocks_id_fk" FOREIGN KEY ("source_block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_integrations" ADD CONSTRAINT "user_integrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_selected_agent_model_id_agent_models_model_id_fk" FOREIGN KEY ("selected_agent_model_id") REFERENCES "public"."agent_models"("model_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_conversations_user" ON "agent_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_agent_conversations_updated" ON "agent_conversations" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_agent_messages_conversation" ON "agent_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_block_folder_assignments_user_folder" ON "block_folder_assignments" USING btree ("user_id","folder_id");--> statement-breakpoint
CREATE INDEX "idx_blocks_user_document" ON "blocks" USING btree ("user_id","document_id");--> statement-breakpoint
CREATE INDEX "idx_blocks_parent" ON "blocks" USING btree ("parent_block_id");--> statement-breakpoint
CREATE INDEX "idx_blocks_updated" ON "blocks" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_blocks_root_position" ON "blocks" USING btree ("document_id","position") WHERE "blocks"."parent_block_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_blocks_child_position" ON "blocks" USING btree ("document_id","parent_block_id","position") WHERE "blocks"."parent_block_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_calendar_event_provider_id" ON "calendar_event_links" USING btree ("user_id","provider","provider_event_id");--> statement-breakpoint
CREATE INDEX "idx_calendar_event_task" ON "calendar_event_links" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_calendar_event_block" ON "calendar_event_links" USING btree ("block_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_daily_review_activity_queue_user_date" ON "daily_review_activity_queue" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "idx_daily_review_activity_queue_updated" ON "daily_review_activity_queue" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_daily_review_states_user_date" ON "daily_review_states" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_daily_review_states_user_date_unique" ON "daily_review_states" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "idx_documents_user_kind" ON "documents" USING btree ("user_id","kind");--> statement-breakpoint
CREATE INDEX "idx_documents_user_folder" ON "documents" USING btree ("user_id","folder_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_documents_daily_unique" ON "documents" USING btree ("user_id","daily_date") WHERE "documents"."kind" = 'daily' AND "documents"."daily_date" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_folders_user" ON "folders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_folders_parent" ON "folders" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_folders_user_slug" ON "folders" USING btree ("user_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_folders_root_position" ON "folders" USING btree ("user_id","position") WHERE "folders"."parent_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_folders_child_position" ON "folders" USING btree ("user_id","parent_id","position") WHERE "folders"."parent_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_recordings_user_status" ON "recordings" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_recordings_document" ON "recordings" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tasks_source_block" ON "tasks" USING btree ("source_block_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_user_status_due" ON "tasks" USING btree ("user_id","status","due_date");--> statement-breakpoint
CREATE INDEX "idx_tasks_user_due" ON "tasks" USING btree ("user_id","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_integrations_provider" ON "user_integrations" USING btree ("user_id","provider");