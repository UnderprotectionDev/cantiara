CREATE TABLE "project_feedback_work_evidence" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"follow_up" text,
	"origin_id" text PRIMARY KEY NOT NULL,
	"qualities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"role" text DEFAULT 'Unspecified' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_feedback_work_evidence_role_check" CHECK ("project_feedback_work_evidence"."role" in ('Supporting', 'Contradicting', 'Provides context', 'Inconclusive', 'Unspecified')),
	CONSTRAINT "project_feedback_work_evidence_follow_up_check" CHECK ("project_feedback_work_evidence"."follow_up" is null or "project_feedback_work_evidence"."follow_up" in ('Follow up', 'Followed up', 'Outcome verified')),
	CONSTRAINT "project_feedback_work_evidence_revision_check" CHECK ("project_feedback_work_evidence"."revision" >= 1)
);
--> statement-breakpoint
CREATE TABLE "project_feedback_work_evidence_history" (
	"actor_alias" text NOT NULL,
	"changed_at" timestamp NOT NULL,
	"changed_fields" jsonb NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"origin_id" text NOT NULL,
	"revision" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_feedback_work_evidence" ADD CONSTRAINT "project_feedback_work_evidence_origin_id_project_feedback_work_origin_id_fk" FOREIGN KEY ("origin_id") REFERENCES "public"."project_feedback_work_origin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_feedback_work_evidence_history" ADD CONSTRAINT "project_feedback_work_evidence_history_origin_id_project_feedback_work_origin_id_fk" FOREIGN KEY ("origin_id") REFERENCES "public"."project_feedback_work_origin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_feedback_work_evidence_history_origin_idx" ON "project_feedback_work_evidence_history" USING btree ("origin_id","revision");