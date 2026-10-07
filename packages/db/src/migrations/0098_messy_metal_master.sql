CREATE TABLE "project_goal_relation" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"goal_id" text NOT NULL,
	"member_id" text NOT NULL,
	"member_type" text NOT NULL,
	"kind" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"removed_at" timestamp,
	CONSTRAINT "project_goal_relation_kind_check" CHECK ("project_goal_relation"."kind" in ('Contributes to Goal', 'Related')),
	CONSTRAINT "project_goal_relation_contribution_check" CHECK ("project_goal_relation"."kind" <> 'Contributes to Goal' or "project_goal_relation"."member_type" in ('Work', 'Milestone', 'Project Release')),
	CONSTRAINT "project_goal_relation_revision_check" CHECK ("project_goal_relation"."revision" >= 0)
);
--> statement-breakpoint
ALTER TABLE "project_goal_relation" ADD CONSTRAINT "project_goal_relation_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_goal_relation_goal_idx" ON "project_goal_relation" USING btree ("project_id","goal_id");--> statement-breakpoint
CREATE INDEX "project_goal_relation_member_idx" ON "project_goal_relation" USING btree ("project_id","member_type","member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_goal_relation_pair_uidx" ON "project_goal_relation" USING btree ("goal_id","kind","member_type","member_id");