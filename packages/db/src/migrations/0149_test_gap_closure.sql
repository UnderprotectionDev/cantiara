CREATE TABLE "project_test_gap_met_session_test" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"gap_id" text NOT NULL,
	"session_test_id" text NOT NULL,
	CONSTRAINT "project_test_gap_met_session_test_pk" PRIMARY KEY("gap_id","session_test_id")
);
--> statement-breakpoint
ALTER TABLE "project_test_gap" ADD COLUMN "closed_at" timestamp;--> statement-breakpoint
ALTER TABLE "project_test_gap" ADD COLUMN "closure_decision_id" text;--> statement-breakpoint
ALTER TABLE "project_test_gap" ADD COLUMN "closure_rationale" text;--> statement-breakpoint
ALTER TABLE "project_test_gap_met_session_test" ADD CONSTRAINT "project_test_gap_met_session_test_gap_fk" FOREIGN KEY ("gap_id") REFERENCES "public"."project_test_gap"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_gap_met_session_test" ADD CONSTRAINT "project_test_gap_met_session_test_session_test_fk" FOREIGN KEY ("session_test_id") REFERENCES "public"."project_session_test"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_test_gap_met_session_test_session_idx" ON "project_test_gap_met_session_test" USING btree ("session_test_id");