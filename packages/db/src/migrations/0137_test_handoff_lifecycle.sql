CREATE TABLE "project_test_handoff" (
	"build_branch" text,
	"build_commit" text,
	"build_name" text,
	"build_repository" text,
	"build_target_environment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"due_date" date,
	"id" text PRIMARY KEY NOT NULL,
	"package_version" integer DEFAULT 0 NOT NULL,
	"project_id" text NOT NULL,
	"purpose" text NOT NULL,
	"state" text DEFAULT 'Draft' NOT NULL,
	"state_changed_at" timestamp DEFAULT now() NOT NULL,
	"target_executor" text,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_test_handoff_state_check" CHECK ("project_test_handoff"."state" in ('Draft', 'Ready to share', 'Shared', 'Result received', 'Closed', 'Canceled')),
	CONSTRAINT "project_test_handoff_package_version_check" CHECK ("project_test_handoff"."package_version" >= 0),
	CONSTRAINT "project_test_handoff_title_check" CHECK (length(btrim("project_test_handoff"."title")) between 1 and 255)
);
--> statement-breakpoint
CREATE TABLE "project_test_handoff_scenario" (
	"case_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"handoff_id" text NOT NULL,
	"position" integer NOT NULL,
	"version" integer NOT NULL,
	CONSTRAINT "project_test_handoff_scenario_pk" PRIMARY KEY("handoff_id","case_id")
);
--> statement-breakpoint
CREATE TABLE "project_test_handoff_session_test" (
	"handoff_id" text NOT NULL,
	"linked_at" timestamp DEFAULT now() NOT NULL,
	"session_test_id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_test_handoff" ADD CONSTRAINT "project_test_handoff_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_handoff_scenario" ADD CONSTRAINT "project_test_handoff_scenario_handoff_fk" FOREIGN KEY ("handoff_id") REFERENCES "public"."project_test_handoff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_handoff_scenario" ADD CONSTRAINT "project_test_handoff_scenario_version_fk" FOREIGN KEY ("case_id","version") REFERENCES "public"."project_planned_test_case_version"("case_id","version") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_handoff_session_test" ADD CONSTRAINT "project_test_handoff_session_test_handoff_fk" FOREIGN KEY ("handoff_id") REFERENCES "public"."project_test_handoff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_handoff_session_test" ADD CONSTRAINT "project_test_handoff_session_test_session_test_fk" FOREIGN KEY ("session_test_id") REFERENCES "public"."project_session_test"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_test_handoff_project_idx" ON "project_test_handoff" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_test_handoff_session_test_handoff_idx" ON "project_test_handoff_session_test" USING btree ("handoff_id");