CREATE TABLE "project_research_session" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"revision" integer NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "project_research_session_revision_check" CHECK ("project_research_session"."revision" > 0),
	CONSTRAINT "project_research_session_identity_check" CHECK ("project_research_session"."data"->>'sourceType' = 'Research Session' and "project_research_session"."data"->>'id' = "project_research_session"."id" and "project_research_session"."data"->>'projectId' = "project_research_session"."project_id" and ("project_research_session"."data"->>'revision')::integer = "project_research_session"."revision")
);
--> statement-breakpoint
ALTER TABLE "project_research_session" ADD CONSTRAINT "project_research_session_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_research_session_project_idx" ON "project_research_session" USING btree ("project_id");