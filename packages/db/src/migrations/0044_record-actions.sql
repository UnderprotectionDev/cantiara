CREATE TABLE "record_action" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"project_id" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"trashed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "record_action_name_check" CHECK (length(btrim("record_action"."name")) > 0),
	CONSTRAINT "record_action_revision_check" CHECK ("record_action"."revision" >= 1)
);
--> statement-breakpoint
ALTER TABLE "record_action" ADD CONSTRAINT "record_action_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "record_action_project_idx" ON "record_action" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "record_action_project_name_uidx" ON "record_action" USING btree ("project_id","name_key");