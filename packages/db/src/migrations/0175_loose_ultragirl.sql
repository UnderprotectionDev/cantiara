CREATE TABLE "project_update" (
	"created_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"mark" text NOT NULL,
	"narrative" text NOT NULL,
	"project_id" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "project_update_mark_check" CHECK ("project_update"."mark" in ('On Track', 'At Risk', 'Off Track')),
	CONSTRAINT "project_update_narrative_check" CHECK (length(btrim("project_update"."narrative")) between 1 and 1000)
);
--> statement-breakpoint
CREATE TABLE "project_update_link" (
	"project_update_id" text NOT NULL,
	"target_id" text NOT NULL,
	"target_type" text NOT NULL,
	CONSTRAINT "project_update_link_pk" PRIMARY KEY("project_update_id","target_type","target_id"),
	CONSTRAINT "project_update_link_target_type_check" CHECK ("project_update_link"."target_type" in ('Risk', 'Decision', 'Milestone', 'Work'))
);
--> statement-breakpoint
ALTER TABLE "project_update" ADD CONSTRAINT "project_update_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_update_link" ADD CONSTRAINT "project_update_link_project_update_id_project_update_id_fk" FOREIGN KEY ("project_update_id") REFERENCES "public"."project_update"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_update_project_created_at_idx" ON "project_update" USING btree ("project_id","created_at");