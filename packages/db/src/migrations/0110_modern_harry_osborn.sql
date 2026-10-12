ALTER TABLE "evidence_binding" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_binding" ADD COLUMN "reviewed_source_revision" integer;--> statement-breakpoint
ALTER TABLE "evidence_binding" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "evidence_binding" ADD COLUMN "reviewed_by" text;