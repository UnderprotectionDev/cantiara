-- Repair databases whose migration journal advanced past 0057 without these columns.
ALTER TABLE "work_external_execution_handoff"
	ADD COLUMN IF NOT EXISTS "reconcile_decision" jsonb;
--> statement-breakpoint
ALTER TABLE "work_external_execution_handoff"
	ADD COLUMN IF NOT EXISTS "result" jsonb;
