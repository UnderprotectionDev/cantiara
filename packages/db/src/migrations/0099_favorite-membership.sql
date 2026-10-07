CREATE TABLE "favorite_membership" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"source_record_id" text NOT NULL,
	"source_record_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_membership_source_type_check" CHECK ("favorite_membership"."source_record_type" in ('Project', 'Document', 'Work', 'Decision', 'Smart Collection'))
);
--> statement-breakpoint
ALTER TABLE "favorite_membership" ADD CONSTRAINT "favorite_membership_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_membership" ADD CONSTRAINT "favorite_membership_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "favorite_membership_source_uidx" ON "favorite_membership" USING btree ("account_id","workspace_id","source_record_type","source_record_id");