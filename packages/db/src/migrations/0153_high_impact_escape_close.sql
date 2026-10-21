CREATE TABLE "workspace_tool_escape_close" (
	"candidate_build" text NOT NULL,
	"closed_at" timestamp DEFAULT now() NOT NULL,
	"escape_id" text NOT NULL,
	"external_copy_how" text NOT NULL,
	"gap_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"impact" text NOT NULL,
	"restore_method" text NOT NULL,
	"workflow_ref" text NOT NULL,
	CONSTRAINT "workspace_tool_escape_close_impact_check" CHECK ("workspace_tool_escape_close"."impact" in ('Canonical truth moved out', 'Lasting parallel source of truth')),
	CONSTRAINT "workspace_tool_escape_close_restore_method_check" CHECK ("workspace_tool_escape_close"."restore_method" in ('Manual recreate', 'Supported import')),
	CONSTRAINT "workspace_tool_escape_close_evidence_check" CHECK (length(btrim("workspace_tool_escape_close"."candidate_build")) >= 1 and length(btrim("workspace_tool_escape_close"."workflow_ref")) >= 1 and length(btrim("workspace_tool_escape_close"."external_copy_how")) >= 1)
);
--> statement-breakpoint
CREATE TABLE "workspace_tool_escape_close_record" (
	"close_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"target_id" text NOT NULL,
	"target_type" text NOT NULL,
	CONSTRAINT "workspace_tool_escape_close_record_type_check" CHECK ("workspace_tool_escape_close_record"."target_type" in ('Project', 'Work', 'Feature', 'Decision'))
);
--> statement-breakpoint
ALTER TABLE "workspace_tool_escape_close" ADD CONSTRAINT "workspace_tool_escape_close_escape_fk" FOREIGN KEY ("escape_id") REFERENCES "public"."workspace_tool_escape"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_tool_escape_close" ADD CONSTRAINT "workspace_tool_escape_close_gap_fk" FOREIGN KEY ("gap_id") REFERENCES "public"."workspace_product_gap"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_tool_escape_close_record" ADD CONSTRAINT "workspace_tool_escape_close_record_close_fk" FOREIGN KEY ("close_id") REFERENCES "public"."workspace_tool_escape_close"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_tool_escape_close_escape_unique" ON "workspace_tool_escape_close" USING btree ("escape_id");--> statement-breakpoint
CREATE INDEX "workspace_tool_escape_close_gap_idx" ON "workspace_tool_escape_close" USING btree ("gap_id");--> statement-breakpoint
CREATE INDEX "workspace_tool_escape_close_record_close_idx" ON "workspace_tool_escape_close_record" USING btree ("close_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_tool_escape_close_record_target_unique" ON "workspace_tool_escape_close_record" USING btree ("close_id","target_type","target_id");