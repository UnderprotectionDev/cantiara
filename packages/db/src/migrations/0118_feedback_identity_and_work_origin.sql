CREATE TABLE "workspace_company_feedback" (
	"company_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"feedback_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_feedback_work_origin" (
	"actor_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"feedback_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"work_id" text NOT NULL,
	CONSTRAINT "project_feedback_work_origin_revision_check" CHECK ("project_feedback_work_origin"."revision" >= 1)
);
--> statement-breakpoint
ALTER TABLE "workspace_company_feedback" ADD CONSTRAINT "workspace_company_feedback_feedback_id_project_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."project_feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_company_feedback" ADD CONSTRAINT "workspace_company_feedback_company_fk" FOREIGN KEY ("company_id","workspace_id") REFERENCES "public"."workspace_company"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_feedback_work_origin" ADD CONSTRAINT "project_feedback_work_origin_feedback_id_project_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."project_feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_feedback_work_origin" ADD CONSTRAINT "project_feedback_work_origin_work_id_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_company_feedback_company_idx" ON "workspace_company_feedback" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_feedback_work_origin_pair_uidx" ON "project_feedback_work_origin" USING btree ("feedback_id","work_id");--> statement-breakpoint
CREATE INDEX "project_feedback_work_origin_work_idx" ON "project_feedback_work_origin" USING btree ("work_id");