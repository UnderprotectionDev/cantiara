ALTER TABLE "work" ADD COLUMN "feature_health_history" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "work" ADD COLUMN "primary_feature_id" text;--> statement-breakpoint
ALTER TABLE "work" ADD COLUMN "primary_spec_id" text;--> statement-breakpoint
ALTER TABLE "work" ADD CONSTRAINT "work_primary_feature_id_work_id_fk" FOREIGN KEY ("primary_feature_id") REFERENCES "public"."work"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_primary_feature_idx" ON "work" USING btree ("primary_feature_id");--> statement-breakpoint
ALTER TABLE "work" ADD CONSTRAINT "work_primary_feature_not_self_check" CHECK ("work"."primary_feature_id" is null or "work"."primary_feature_id" <> "work"."id");