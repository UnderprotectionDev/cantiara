CREATE TABLE "project_goal" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"intended_outcome" text,
	"observed_outcome_learning" text,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_goal_revision_check" CHECK ("project_goal"."revision" >= 0),
	CONSTRAINT "project_goal_title_check" CHECK (length(btrim("project_goal"."title")) between 1 and 255),
	CONSTRAINT "project_goal_description_check" CHECK (length(btrim("project_goal"."description")) between 1 and 10000)
);
--> statement-breakpoint
ALTER TABLE "project_goal" ADD CONSTRAINT "project_goal_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_goal_project_created_idx" ON "project_goal" USING btree ("project_id","created_at","id");