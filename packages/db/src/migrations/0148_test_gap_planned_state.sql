CREATE TABLE "project_test_gap_case_bind" (
	"case_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"gap_id" text NOT NULL,
	"version" integer NOT NULL,
	CONSTRAINT "project_test_gap_case_bind_pk" PRIMARY KEY("gap_id","case_id","version")
);
--> statement-breakpoint
CREATE TABLE "project_test_gap_handoff_bind" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"gap_id" text NOT NULL,
	"handoff_id" text NOT NULL,
	CONSTRAINT "project_test_gap_handoff_bind_pk" PRIMARY KEY("gap_id","handoff_id")
);
--> statement-breakpoint
ALTER TABLE "project_test_gap" ADD COLUMN "state" text DEFAULT 'Open' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_test_gap" ADD COLUMN "state_changed_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "project_test_gap_case_bind" ADD CONSTRAINT "project_test_gap_case_bind_gap_fk" FOREIGN KEY ("gap_id") REFERENCES "public"."project_test_gap"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_gap_case_bind" ADD CONSTRAINT "project_test_gap_case_bind_version_fk" FOREIGN KEY ("case_id","version") REFERENCES "public"."project_planned_test_case_version"("case_id","version") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_gap_handoff_bind" ADD CONSTRAINT "project_test_gap_handoff_bind_gap_fk" FOREIGN KEY ("gap_id") REFERENCES "public"."project_test_gap"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_gap_handoff_bind" ADD CONSTRAINT "project_test_gap_handoff_bind_handoff_fk" FOREIGN KEY ("handoff_id") REFERENCES "public"."project_test_handoff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_gap" ADD CONSTRAINT "project_test_gap_state_check" CHECK ("project_test_gap"."state" in ('Open', 'Planned', 'Met by result', 'Not needed'));