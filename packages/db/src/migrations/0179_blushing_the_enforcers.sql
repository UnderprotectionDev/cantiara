ALTER TABLE "external_surface" ADD COLUMN "root_id" text;--> statement-breakpoint
ALTER TABLE "external_surface" ADD COLUMN "root_kind" text;--> statement-breakpoint
ALTER TABLE "external_surface" ADD COLUMN "surface_kind" text;--> statement-breakpoint
ALTER TABLE "external_surface_snapshot_revision" ADD COLUMN "approval_fingerprint" text;--> statement-breakpoint
ALTER TABLE "external_surface_snapshot_revision" ADD COLUMN "approval_id" text;--> statement-breakpoint
ALTER TABLE "external_surface_snapshot_revision" ADD COLUMN "placeholders_acknowledged" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "external_surface_snapshot_revision_approval_uidx" ON "external_surface_snapshot_revision" USING btree ("approval_id");