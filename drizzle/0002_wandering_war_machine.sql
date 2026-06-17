ALTER TABLE "agent_messages" DROP CONSTRAINT "agent_messages_conversation_id_agent_conversations_id_fk";
--> statement-breakpoint
ALTER TABLE "block_folder_assignments" DROP CONSTRAINT "block_folder_assignments_block_id_blocks_id_fk";
--> statement-breakpoint
ALTER TABLE "block_folder_assignments" DROP CONSTRAINT "block_folder_assignments_folder_id_folders_id_fk";
--> statement-breakpoint
ALTER TABLE "blocks" DROP CONSTRAINT "blocks_parent_block_id_blocks_id_fk";
--> statement-breakpoint
ALTER TABLE "blocks" DROP CONSTRAINT "blocks_daily_block_id_blocks_id_fk";
--> statement-breakpoint
ALTER TABLE "calendar_event_links" DROP CONSTRAINT "calendar_event_links_block_id_blocks_id_fk";
--> statement-breakpoint
ALTER TABLE "daily_blocks" DROP CONSTRAINT "daily_blocks_block_id_blocks_id_fk";
--> statement-breakpoint
ALTER TABLE "folders" DROP CONSTRAINT "folders_parent_folder_id_folders_id_fk";
--> statement-breakpoint
ALTER TABLE "todo_blocks" DROP CONSTRAINT "todo_blocks_block_id_blocks_id_fk";
--> statement-breakpoint
ALTER TABLE "agent_conversations" ADD CONSTRAINT "agent_conversations_id_user_id_unique" UNIQUE("id","user_id");--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_id_user_id_unique" UNIQUE("id","user_id");--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_id_user_id_unique" UNIQUE("id","user_id");--> statement-breakpoint
ALTER TABLE "todo_blocks" ADD CONSTRAINT "todo_blocks_block_id_user_id_unique" UNIQUE("block_id","user_id");--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_conversation_same_user_fk" FOREIGN KEY ("conversation_id","user_id") REFERENCES "public"."agent_conversations"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_folder_assignments" ADD CONSTRAINT "block_folder_assignments_block_same_user_fk" FOREIGN KEY ("block_id","user_id") REFERENCES "public"."blocks"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_folder_assignments" ADD CONSTRAINT "block_folder_assignments_folder_same_user_fk" FOREIGN KEY ("folder_id","user_id") REFERENCES "public"."folders"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_parent_same_user_fk" FOREIGN KEY ("parent_block_id","user_id") REFERENCES "public"."blocks"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_daily_same_user_fk" FOREIGN KEY ("daily_block_id","user_id") REFERENCES "public"."blocks"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_links" ADD CONSTRAINT "calendar_event_links_block_same_user_fk" FOREIGN KEY ("block_id","user_id") REFERENCES "public"."blocks"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_blocks" ADD CONSTRAINT "daily_blocks_block_same_user_fk" FOREIGN KEY ("block_id","user_id") REFERENCES "public"."blocks"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_same_user_fk" FOREIGN KEY ("parent_folder_id","user_id") REFERENCES "public"."folders"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_blocks" ADD CONSTRAINT "todo_blocks_block_same_user_fk" FOREIGN KEY ("block_id","user_id") REFERENCES "public"."blocks"("id","user_id") ON DELETE cascade ON UPDATE no action;
