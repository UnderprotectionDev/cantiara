CREATE TABLE "project_session_test" (
	"bind_origin" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expected_behavior" text,
	"id" text PRIMARY KEY NOT NULL,
	"linked_at" timestamp,
	"project_id" text NOT NULL,
	"purpose" text,
	"scenario_id" text,
	"scenario_version" integer,
	"title" text NOT NULL,
	CONSTRAINT "project_session_test_bind_check" CHECK (("project_session_test"."scenario_id" is null and "project_session_test"."scenario_version" is null and "project_session_test"."bind_origin" is null and "project_session_test"."linked_at" is null) or ("project_session_test"."scenario_id" is not null and "project_session_test"."scenario_version" is not null and "project_session_test"."bind_origin" in ('Bound when recorded', 'Linked later') and (("project_session_test"."bind_origin" = 'Linked later') = ("project_session_test"."linked_at" is not null)))),
	CONSTRAINT "project_session_test_content_check" CHECK ((("project_session_test"."purpose" is null) = ("project_session_test"."expected_behavior" is null)) and ("project_session_test"."purpose" is not null or "project_session_test"."bind_origin" = 'Bound when recorded')),
	CONSTRAINT "project_session_test_title_check" CHECK (length(btrim("project_session_test"."title")) between 1 and 255)
);
--> statement-breakpoint
ALTER TABLE "project_session_test" ADD CONSTRAINT "project_session_test_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_session_test" ADD CONSTRAINT "project_session_test_scenario_version_fk" FOREIGN KEY ("scenario_id","scenario_version") REFERENCES "public"."project_planned_test_case_version"("case_id","version") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_session_test_project_idx" ON "project_session_test" USING btree ("project_id");