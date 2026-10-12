CREATE TABLE "research_session_binding_preview" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"session_id" text NOT NULL,
	"project_id" text NOT NULL,
	"plan" jsonb NOT NULL,
	"expires_at" timestamp NOT NULL,
	"confirmed_binding_id" text
);
--> statement-breakpoint
CREATE TABLE "evidence_binding" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"source_project_id" text NOT NULL,
	"source_record_id" text NOT NULL,
	"target_project_id" text NOT NULL,
	"target_record_id" text NOT NULL,
	"target_record_type" text NOT NULL,
	"pin" jsonb NOT NULL,
	"role" text DEFAULT 'Unspecified' NOT NULL,
	"actor_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_binding_role_check" CHECK ("evidence_binding"."role" in ('Supporting', 'Contradicting', 'Provides context', 'Inconclusive', 'Unspecified'))
);
--> statement-breakpoint
CREATE TABLE "record_origin" (
	"id" text PRIMARY KEY NOT NULL,
	"evidence_binding_id" text NOT NULL,
	"source_record_id" text NOT NULL,
	"target_record_id" text NOT NULL,
	"location" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"original_message" text NOT NULL,
	"channel" text,
	"occurred_at" timestamp NOT NULL,
	"status" text DEFAULT 'New' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_feedback_status_check" CHECK ("project_feedback"."status" in ('New', 'Reviewed', 'Archived')),
	CONSTRAINT "project_feedback_title_check" CHECK (length(btrim("project_feedback"."title")) between 1 and 255),
	CONSTRAINT "project_feedback_message_check" CHECK (length(btrim("project_feedback"."original_message")) between 1 and 20000),
	CONSTRAINT "project_feedback_revision_check" CHECK ("project_feedback"."revision" >= 0)
);
--> statement-breakpoint
ALTER TABLE "research_session_binding_preview" ADD CONSTRAINT "research_session_binding_preview_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_session_binding_preview" ADD CONSTRAINT "research_session_binding_preview_session_id_project_research_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."project_research_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_session_binding_preview" ADD CONSTRAINT "research_session_binding_preview_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_binding" ADD CONSTRAINT "evidence_binding_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_binding" ADD CONSTRAINT "evidence_binding_source_project_id_project_id_fk" FOREIGN KEY ("source_project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_binding" ADD CONSTRAINT "evidence_binding_target_project_id_project_id_fk" FOREIGN KEY ("target_project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_origin" ADD CONSTRAINT "record_origin_evidence_binding_id_evidence_binding_id_fk" FOREIGN KEY ("evidence_binding_id") REFERENCES "public"."evidence_binding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_feedback" ADD CONSTRAINT "project_feedback_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "research_binding_preview_expiry_idx" ON "research_session_binding_preview" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "evidence_binding_source_idx" ON "evidence_binding" USING btree ("source_project_id","source_record_id");--> statement-breakpoint
CREATE INDEX "evidence_binding_target_idx" ON "evidence_binding" USING btree ("target_project_id","target_record_id");--> statement-breakpoint
CREATE INDEX "project_feedback_project_idx" ON "project_feedback" USING btree ("project_id");