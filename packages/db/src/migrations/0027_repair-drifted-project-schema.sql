-- Repair databases whose migration metadata is ahead of the schema for the
-- Project-owned Work identity and Custom field definitions.
CREATE TABLE IF NOT EXISTS "work_retired_identity" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"merge_id" text NOT NULL,
	"project_id" text NOT NULL,
	"retired_at" timestamp DEFAULT now() NOT NULL,
	"surviving_work_id" text NOT NULL,
	CONSTRAINT "work_retired_identity_key_check" CHECK (length(btrim("work_retired_identity"."key")) > 0)
);
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'work_retired_identity_project_id_project_id_fk'
			AND conrelid = 'public.work_retired_identity'::regclass
	) THEN
		ALTER TABLE "work_retired_identity"
			ADD CONSTRAINT "work_retired_identity_project_id_project_id_fk"
			FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'work_retired_identity_surviving_work_id_work_id_fk'
			AND conrelid = 'public.work_retired_identity'::regclass
	) THEN
		ALTER TABLE "work_retired_identity"
			ADD CONSTRAINT "work_retired_identity_surviving_work_id_work_id_fk"
			FOREIGN KEY ("surviving_work_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_retired_identity_survivor_idx" ON "work_retired_identity" USING btree ("surviving_work_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "work_retired_identity_project_key_uidx" ON "work_retired_identity" USING btree ("project_id", "key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "custom_field_definition" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"project_id" text NOT NULL,
	"record_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"type" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "custom_field_definition_name_check" CHECK (length(btrim("custom_field_definition"."name")) > 0),
	CONSTRAINT "custom_field_definition_type_check" CHECK ("custom_field_definition"."type" in ('Text', 'Number', 'Boolean', 'Date', 'Single select', 'Multi select')),
	CONSTRAINT "custom_field_definition_revision_check" CHECK ("custom_field_definition"."revision" >= 0)
);
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'custom_field_definition_project_id_project_id_fk'
			AND conrelid = 'public.custom_field_definition'::regclass
	) THEN
		ALTER TABLE "custom_field_definition"
			ADD CONSTRAINT "custom_field_definition_project_id_project_id_fk"
			FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "custom_field_definition_project_idx" ON "custom_field_definition" USING btree ("project_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "custom_field_definition_project_name_uidx" ON "custom_field_definition" USING btree ("project_id", "name_key");
