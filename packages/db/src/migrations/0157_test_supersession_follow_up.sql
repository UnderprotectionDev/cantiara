CREATE TABLE "project_session_test_supersession" (
	"actor_account_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"newer_session_test_id" text NOT NULL,
	"older_session_test_id" text NOT NULL,
	"project_id" text NOT NULL,
	"reason" text,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_session_test_supersession_distinct_check" CHECK ("project_session_test_supersession"."newer_session_test_id" <> "project_session_test_supersession"."older_session_test_id")
);
--> statement-breakpoint
CREATE TABLE "project_test_follow_up_link" (
	"actor_account_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"mode" text NOT NULL,
	"project_id" text NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"session_id" text NOT NULL,
	"session_test_id" text NOT NULL,
	"work_id" text NOT NULL,
	CONSTRAINT "project_test_follow_up_link_mode_check" CHECK ("project_test_follow_up_link"."mode" in ('Created', 'Attached'))
);
--> statement-breakpoint
CREATE TABLE "project_test_result_binding" (
	"actor_account_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"judged_session_test_ids" jsonb NOT NULL,
	"project_id" text NOT NULL,
	"reason" text,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"scenario_id" text NOT NULL,
	"scenario_version" integer NOT NULL,
	"session_test_id" text NOT NULL,
	CONSTRAINT "project_test_result_binding_version_check" CHECK ("project_test_result_binding"."scenario_version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "project_session_test_supersession" ADD CONSTRAINT "project_session_test_supersession_newer_session_test_id_project_session_test_id_fk" FOREIGN KEY ("newer_session_test_id") REFERENCES "public"."project_session_test"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_session_test_supersession" ADD CONSTRAINT "project_session_test_supersession_older_session_test_id_project_session_test_id_fk" FOREIGN KEY ("older_session_test_id") REFERENCES "public"."project_session_test"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_session_test_supersession" ADD CONSTRAINT "project_session_test_supersession_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_follow_up_link" ADD CONSTRAINT "project_test_follow_up_link_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_follow_up_link" ADD CONSTRAINT "project_test_follow_up_link_session_id_project_test_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."project_test_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_follow_up_link" ADD CONSTRAINT "project_test_follow_up_link_session_test_id_project_session_test_id_fk" FOREIGN KEY ("session_test_id") REFERENCES "public"."project_session_test"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_follow_up_link" ADD CONSTRAINT "project_test_follow_up_link_work_id_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_result_binding" ADD CONSTRAINT "project_test_result_binding_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_result_binding" ADD CONSTRAINT "project_test_result_binding_session_test_id_project_session_test_id_fk" FOREIGN KEY ("session_test_id") REFERENCES "public"."project_session_test"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_session_test_supersession_pair_uidx" ON "project_session_test_supersession" USING btree ("newer_session_test_id","older_session_test_id");--> statement-breakpoint
CREATE INDEX "project_session_test_supersession_project_idx" ON "project_session_test_supersession" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_test_follow_up_link_pair_uidx" ON "project_test_follow_up_link" USING btree ("session_test_id","work_id");--> statement-breakpoint
CREATE INDEX "project_test_follow_up_link_work_idx" ON "project_test_follow_up_link" USING btree ("work_id");--> statement-breakpoint
CREATE INDEX "project_test_follow_up_link_project_idx" ON "project_test_follow_up_link" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_test_result_binding_scenario_idx" ON "project_test_result_binding" USING btree ("project_id","scenario_id","scenario_version");