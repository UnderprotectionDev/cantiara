ALTER TABLE "project" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_revision_check" CHECK ("project"."revision" >= 0);