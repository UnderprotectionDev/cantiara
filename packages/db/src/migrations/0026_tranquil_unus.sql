CREATE TABLE IF NOT EXISTS "work_draft" (
	"account_id" text NOT NULL,
	"checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"finalized_work_id" text,
	"finalizing_client_idempotency_key" text,
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'Task' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "work_draft_type_check" CHECK ("work_draft"."type" in ('Feature', 'Bug', 'Task', 'Research', 'Improvement')),
	CONSTRAINT "work_draft_revision_check" CHECK ("work_draft"."revision" >= 0),
	CONSTRAINT "work_draft_finalization_check" CHECK ("work_draft"."consumed_at" is null or "work_draft"."finalized_work_id" is not null)
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "work_draft" ADD CONSTRAINT "work_draft_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "work_draft" ADD CONSTRAINT "work_draft_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_draft_account_project_updated_idx" ON "work_draft" USING btree ("account_id","project_id","updated_at");
