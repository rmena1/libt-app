CREATE TYPE "public"."ai_message_role" AS ENUM('user', 'assistant', 'tool', 'system');--> statement-breakpoint
CREATE TYPE "public"."block_kind" AS ENUM('daily', 'text', 'todo');--> statement-breakpoint
CREATE TYPE "public"."todo_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."todo_recurrence" AS ENUM('weekly', 'monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."todo_status" AS ENUM('pending', 'completed', 'canceled');--> statement-breakpoint
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
	"kind" "block_kind" NOT NULL,
	"parent_block_id" text,
	"daily_block_id" text NOT NULL,
	"position" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"is_collapsed" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "blocks_root_shape_check" CHECK ((
      "blocks"."kind" = 'daily'
      AND "blocks"."parent_block_id" IS NULL
      AND "blocks"."daily_block_id" = "blocks"."id"
    ) OR (
      "blocks"."kind" <> 'daily'
      AND "blocks"."parent_block_id" IS NOT NULL
    ))
);
--> statement-breakpoint
CREATE TABLE "calendar_event_links" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"block_id" text NOT NULL,
	"provider" text DEFAULT 'google' NOT NULL,
	"provider_event_id" text NOT NULL,
	"synced_title" text,
	"synced_starts_at" text,
	"synced_ends_at" text,
	"last_synced_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_blocks" (
	"block_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "daily_blocks_date_check" CHECK ("daily_blocks"."date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
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
CREATE TABLE "folders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"path" text NOT NULL,
	"parent_folder_id" text,
	"position" text NOT NULL,
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
CREATE TABLE "todo_blocks" (
	"block_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" "todo_status" DEFAULT 'pending' NOT NULL,
	"due_time" text,
	"priority" "todo_priority",
	"recurrence" "todo_recurrence",
	"recurrence_parent_id" text,
	"completed_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "todo_blocks_due_time_check" CHECK ("todo_blocks"."due_time" IS NULL OR "todo_blocks"."due_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
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
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_parent_block_id_blocks_id_fk" FOREIGN KEY ("parent_block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_daily_block_id_blocks_id_fk" FOREIGN KEY ("daily_block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_links" ADD CONSTRAINT "calendar_event_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_links" ADD CONSTRAINT "calendar_event_links_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_blocks" ADD CONSTRAINT "daily_blocks_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_blocks" ADD CONSTRAINT "daily_blocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_review_activity_queue" ADD CONSTRAINT "daily_review_activity_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_review_states" ADD CONSTRAINT "daily_review_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_folder_id_folders_id_fk" FOREIGN KEY ("parent_folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_blocks" ADD CONSTRAINT "todo_blocks_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_blocks" ADD CONSTRAINT "todo_blocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_blocks" ADD CONSTRAINT "todo_blocks_recurrence_parent_id_todo_blocks_block_id_fk" FOREIGN KEY ("recurrence_parent_id") REFERENCES "public"."todo_blocks"("block_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_integrations" ADD CONSTRAINT "user_integrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_selected_agent_model_id_agent_models_model_id_fk" FOREIGN KEY ("selected_agent_model_id") REFERENCES "public"."agent_models"("model_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_conversations_user" ON "agent_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_agent_conversations_updated" ON "agent_conversations" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_agent_messages_conversation" ON "agent_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_block_folder_assignments_user_folder" ON "block_folder_assignments" USING btree ("user_id","folder_id");--> statement-breakpoint
CREATE INDEX "idx_block_folder_assignments_user_block" ON "block_folder_assignments" USING btree ("user_id","block_id");--> statement-breakpoint
CREATE INDEX "idx_blocks_user_daily" ON "blocks" USING btree ("user_id","daily_block_id");--> statement-breakpoint
CREATE INDEX "idx_blocks_user_kind" ON "blocks" USING btree ("user_id","kind");--> statement-breakpoint
CREATE INDEX "idx_blocks_parent" ON "blocks" USING btree ("parent_block_id","position");--> statement-breakpoint
CREATE INDEX "idx_blocks_updated" ON "blocks" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_blocks_child_position" ON "blocks" USING btree ("parent_block_id","position") WHERE "blocks"."parent_block_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_calendar_event_links_provider_event" ON "calendar_event_links" USING btree ("user_id","provider","provider_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_calendar_event_links_block_provider" ON "calendar_event_links" USING btree ("block_id","provider");--> statement-breakpoint
CREATE INDEX "idx_calendar_event_links_user_block" ON "calendar_event_links" USING btree ("user_id","block_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_daily_blocks_user_date" ON "daily_blocks" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_daily_review_activity_queue_user_date" ON "daily_review_activity_queue" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "idx_daily_review_activity_queue_updated" ON "daily_review_activity_queue" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_daily_review_states_user_date" ON "daily_review_states" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_daily_review_states_user_date_unique" ON "daily_review_states" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "idx_folders_user" ON "folders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_folders_parent" ON "folders" USING btree ("parent_folder_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_folders_user_path" ON "folders" USING btree ("user_id","path");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_folders_root_slug" ON "folders" USING btree ("user_id","slug") WHERE "folders"."parent_folder_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_folders_child_slug" ON "folders" USING btree ("user_id","parent_folder_id","slug") WHERE "folders"."parent_folder_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_folders_root_position" ON "folders" USING btree ("user_id","position") WHERE "folders"."parent_folder_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_folders_child_position" ON "folders" USING btree ("user_id","parent_folder_id","position") WHERE "folders"."parent_folder_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_todo_blocks_user_status" ON "todo_blocks" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_todo_blocks_user_priority" ON "todo_blocks" USING btree ("user_id","priority");--> statement-breakpoint
CREATE INDEX "idx_todo_blocks_recurrence_parent" ON "todo_blocks" USING btree ("recurrence_parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_integrations_provider" ON "user_integrations" USING btree ("user_id","provider");