CREATE TABLE "daily_focus_membership" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"focus_date" date NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"work_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	CONSTRAINT "daily_focus_membership_date_check" CHECK ("daily_focus_membership"."focus_date"::text ~ '^\d{4}-\d{2}-\d{2}$')
);
--> statement-breakpoint
ALTER TABLE "daily_focus_membership" ADD CONSTRAINT "daily_focus_membership_work_id_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_focus_membership" ADD CONSTRAINT "daily_focus_membership_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_focus_membership_day_idx" ON "daily_focus_membership" USING btree ("workspace_id","focus_date");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_focus_membership_work_day_uidx" ON "daily_focus_membership" USING btree ("workspace_id","work_id","focus_date");