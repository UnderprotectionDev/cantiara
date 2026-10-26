CREATE TABLE "production_incident_follow_up" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"incident_id" text NOT NULL,
	"incident_revision" integer NOT NULL,
	"preview_fingerprint" text NOT NULL,
	"project_id" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"work_id" text NOT NULL,
	CONSTRAINT "production_incident_follow_up_revision_check" CHECK ("production_incident_follow_up"."revision" >= 0)
);
--> statement-breakpoint
ALTER TABLE "production_incident_follow_up" ADD CONSTRAINT "production_incident_follow_up_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_incident_follow_up" ADD CONSTRAINT "production_incident_follow_up_work_fk" FOREIGN KEY ("project_id","work_id") REFERENCES "public"."work"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "production_incident_follow_up_incident_idx" ON "production_incident_follow_up" USING btree ("project_id","incident_id");