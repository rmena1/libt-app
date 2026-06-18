CREATE TYPE "public"."audio_backup_status" AS ENUM('archived', 'transcribed', 'transcription_failed');--> statement-breakpoint
CREATE TYPE "public"."meeting_recording_mode" AS ENUM('mic', 'meeting', 'video', 'file');--> statement-breakpoint
CREATE TYPE "public"."meeting_recording_status" AS ENUM('processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."recording_upload_status" AS ENUM('uploading', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "audio_backups" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"recording_id" text,
	"bucket_name" text NOT NULL,
	"object_key" text NOT NULL,
	"original_file_name" text NOT NULL,
	"content_type" text,
	"size_bytes" integer NOT NULL,
	"source" "meeting_recording_mode" NOT NULL,
	"status" "audio_backup_status" DEFAULT 'archived' NOT NULL,
	"error_message" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "audio_backups_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
CREATE TABLE "meeting_recordings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mode" "meeting_recording_mode" NOT NULL,
	"status" "meeting_recording_status" DEFAULT 'processing' NOT NULL,
	"daily_date" text NOT NULL,
	"started_at_time" text,
	"title" text,
	"transcript" text,
	"summary" jsonb,
	"error_message" text,
	"visible_block_id" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "meeting_recordings_id_user_id_unique" UNIQUE("id","user_id"),
	CONSTRAINT "meeting_recordings_daily_date_check" CHECK ("meeting_recordings"."daily_date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
	CONSTRAINT "meeting_recordings_started_at_time_check" CHECK ("meeting_recordings"."started_at_time" IS NULL OR "meeting_recordings"."started_at_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
--> statement-breakpoint
CREATE TABLE "recording_upload_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"recording_id" text NOT NULL,
	"status" "recording_upload_status" DEFAULT 'uploading' NOT NULL,
	"mode" "meeting_recording_mode" NOT NULL,
	"daily_date" text NOT NULL,
	"started_at_time" text,
	"total_chunks" integer NOT NULL,
	"uploaded_chunks" integer DEFAULT 0 NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"original_file_name" text,
	"content_type" text,
	"error_message" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "recording_upload_sessions_total_chunks_check" CHECK ("recording_upload_sessions"."total_chunks" > 0),
	CONSTRAINT "recording_upload_sessions_uploaded_chunks_check" CHECK ("recording_upload_sessions"."uploaded_chunks" >= 0 AND "recording_upload_sessions"."uploaded_chunks" <= "recording_upload_sessions"."total_chunks"),
	CONSTRAINT "recording_upload_sessions_size_bytes_check" CHECK ("recording_upload_sessions"."size_bytes" >= 0),
	CONSTRAINT "recording_upload_sessions_daily_date_check" CHECK ("recording_upload_sessions"."daily_date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
	CONSTRAINT "recording_upload_sessions_started_at_time_check" CHECK ("recording_upload_sessions"."started_at_time" IS NULL OR "recording_upload_sessions"."started_at_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
--> statement-breakpoint
ALTER TABLE "audio_backups" ADD CONSTRAINT "audio_backups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_backups" ADD CONSTRAINT "audio_backups_recording_same_user_fk" FOREIGN KEY ("recording_id","user_id") REFERENCES "public"."meeting_recordings"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_recordings" ADD CONSTRAINT "meeting_recordings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_recordings" ADD CONSTRAINT "meeting_recordings_visible_block_id_blocks_id_fk" FOREIGN KEY ("visible_block_id") REFERENCES "public"."blocks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recording_upload_sessions" ADD CONSTRAINT "recording_upload_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recording_upload_sessions" ADD CONSTRAINT "recording_upload_sessions_recording_same_user_fk" FOREIGN KEY ("recording_id","user_id") REFERENCES "public"."meeting_recordings"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audio_backups_user_created" ON "audio_backups" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audio_backups_recording" ON "audio_backups" USING btree ("recording_id");--> statement-breakpoint
CREATE INDEX "idx_meeting_recordings_user_created" ON "meeting_recordings" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_meeting_recordings_user_status" ON "meeting_recordings" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_recording_upload_sessions_user_created" ON "recording_upload_sessions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_recording_upload_sessions_recording" ON "recording_upload_sessions" USING btree ("recording_id");