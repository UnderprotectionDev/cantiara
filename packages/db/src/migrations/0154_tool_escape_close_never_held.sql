ALTER TABLE "workspace_tool_escape_close" DROP CONSTRAINT "workspace_tool_escape_close_impact_check";--> statement-breakpoint
ALTER TABLE "workspace_tool_escape_close" ALTER COLUMN "candidate_build" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_tool_escape_close" ALTER COLUMN "external_copy_how" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_tool_escape_close" ALTER COLUMN "restore_method" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_tool_escape_close" ALTER COLUMN "workflow_ref" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_tool_escape_close" ADD CONSTRAINT "workspace_tool_escape_close_impact_check" CHECK ("workspace_tool_escape_close"."impact" in ('Canonical truth moved out', 'Lasting parallel source of truth', 'Never held parallel truth'));