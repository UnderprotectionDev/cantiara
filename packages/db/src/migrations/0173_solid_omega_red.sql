CREATE TABLE "production_incident_link" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"decision_id" text,
	"github_record_id" text,
	"id" text PRIMARY KEY NOT NULL,
	"incident_id" text NOT NULL,
	"project_id" text NOT NULL,
	"release_id" text,
	"removed_at" timestamp,
	"revision" integer DEFAULT 0 NOT NULL,
	"risk_id" text,
	"target_type" text NOT NULL,
	"work_id" text,
	CONSTRAINT "production_incident_link_target_type_check" CHECK ("production_incident_link"."target_type" in ('Bug', 'GitHub PR', 'Project Release', 'Risk', 'Decision')),
	CONSTRAINT "production_incident_link_target_check" CHECK (("production_incident_link"."target_type" = 'Bug' and "production_incident_link"."work_id" is not null and "production_incident_link"."github_record_id" is null and "production_incident_link"."release_id" is null and "production_incident_link"."risk_id" is null and "production_incident_link"."decision_id" is null) or ("production_incident_link"."target_type" = 'GitHub PR' and "production_incident_link"."github_record_id" is not null and "production_incident_link"."work_id" is null and "production_incident_link"."release_id" is null and "production_incident_link"."risk_id" is null and "production_incident_link"."decision_id" is null) or ("production_incident_link"."target_type" = 'Project Release' and "production_incident_link"."release_id" is not null and "production_incident_link"."work_id" is null and "production_incident_link"."github_record_id" is null and "production_incident_link"."risk_id" is null and "production_incident_link"."decision_id" is null) or ("production_incident_link"."target_type" = 'Risk' and "production_incident_link"."risk_id" is not null and "production_incident_link"."work_id" is null and "production_incident_link"."github_record_id" is null and "production_incident_link"."release_id" is null and "production_incident_link"."decision_id" is null) or ("production_incident_link"."target_type" = 'Decision' and "production_incident_link"."decision_id" is not null and "production_incident_link"."work_id" is null and "production_incident_link"."github_record_id" is null and "production_incident_link"."release_id" is null and "production_incident_link"."risk_id" is null)),
	CONSTRAINT "production_incident_link_revision_check" CHECK ("production_incident_link"."revision" >= 0)
);
--> statement-breakpoint
ALTER TABLE "production_incident_link" ADD CONSTRAINT "production_incident_link_github_record_id_project_github_external_record_id_fk" FOREIGN KEY ("github_record_id") REFERENCES "public"."project_github_external_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_incident_link" ADD CONSTRAINT "production_incident_link_incident_id_production_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."production_incident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_incident_link" ADD CONSTRAINT "production_incident_link_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_incident_link" ADD CONSTRAINT "production_incident_link_release_id_project_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."project_release"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_incident_link" ADD CONSTRAINT "production_incident_link_risk_id_project_risk_id_fk" FOREIGN KEY ("risk_id") REFERENCES "public"."project_risk"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_incident_link" ADD CONSTRAINT "production_incident_link_work_fk" FOREIGN KEY ("project_id","work_id") REFERENCES "public"."work"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_incident_link" ADD CONSTRAINT "production_incident_link_decision_fk" FOREIGN KEY ("project_id","decision_id") REFERENCES "public"."project_decision"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "production_incident_link_incident_idx" ON "production_incident_link" USING btree ("project_id","incident_id");