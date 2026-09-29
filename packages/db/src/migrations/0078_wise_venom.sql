CREATE TABLE "focus_period" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"purpose" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" text DEFAULT 'Planned' NOT NULL,
	"started_at" timestamp,
	"closed_at" timestamp,
	"start_snapshot" jsonb,
	"close_snapshot" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "focus_period_status_check" CHECK ("focus_period"."status" in ('Planned', 'Active', 'Closed', 'Canceled')),
	CONSTRAINT "focus_period_purpose_check" CHECK (length(btrim("focus_period"."purpose")) between 1 and 1000),
	CONSTRAINT "focus_period_window_check" CHECK ("focus_period"."end_date" - "focus_period"."start_date" between 6 and 55)
);
--> statement-breakpoint
CREATE TABLE "focus_period_active_work" (
	"work_id" text PRIMARY KEY NOT NULL,
	"period_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "focus_period_membership" (
	"id" text PRIMARY KEY NOT NULL,
	"period_id" text NOT NULL,
	"work_id" text NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"removed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "focus_period" ADD CONSTRAINT "focus_period_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_period_active_work" ADD CONSTRAINT "focus_period_active_work_work_id_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_period_active_work" ADD CONSTRAINT "focus_period_active_work_period_id_focus_period_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."focus_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_period_membership" ADD CONSTRAINT "focus_period_membership_period_id_focus_period_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."focus_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_period_membership" ADD CONSTRAINT "focus_period_membership_work_id_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "focus_period_workspace_idx" ON "focus_period" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "focus_period_active_work_period_idx" ON "focus_period_active_work" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "focus_period_membership_period_idx" ON "focus_period_membership" USING btree ("period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "focus_period_membership_current_uidx" ON "focus_period_membership" USING btree ("period_id","work_id") WHERE "focus_period_membership"."removed_at" is null;