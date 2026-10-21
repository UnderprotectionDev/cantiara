CREATE TABLE "workspace_tool_escape" (
	"gap_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"intended_job" text NOT NULL,
	"note" text,
	"occurred_at" timestamp NOT NULL,
	"project_id" text NOT NULL,
	"reasons" text[] NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"source_id" text NOT NULL,
	"source_type" text NOT NULL,
	"tool" text NOT NULL,
	CONSTRAINT "workspace_tool_escape_source_type_check" CHECK ("workspace_tool_escape"."source_type" in ('Project', 'Work', 'Feature', 'Decision')),
	CONSTRAINT "workspace_tool_escape_reasons_check" CHECK (cardinality("workspace_tool_escape"."reasons") between 1 and 5 and "workspace_tool_escape"."reasons" <@ array['Missing capability', 'Faster', 'More reliable', 'Usability', 'Habit']::text[]),
	CONSTRAINT "workspace_tool_escape_tool_check" CHECK (length(btrim("workspace_tool_escape"."tool")) between 1 and 120),
	CONSTRAINT "workspace_tool_escape_intended_job_check" CHECK (length(btrim("workspace_tool_escape"."intended_job")) >= 1)
);
--> statement-breakpoint
ALTER TABLE "workspace_tool_escape" ADD CONSTRAINT "workspace_tool_escape_gap_fk" FOREIGN KEY ("gap_id") REFERENCES "public"."workspace_product_gap"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_tool_escape_gap_idx" ON "workspace_tool_escape" USING btree ("gap_id","occurred_at");--> statement-breakpoint
CREATE INDEX "workspace_tool_escape_project_idx" ON "workspace_tool_escape" USING btree ("project_id");