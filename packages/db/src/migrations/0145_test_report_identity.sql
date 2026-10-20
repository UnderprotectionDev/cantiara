CREATE TABLE "project_test_session_identity" (
	"external_session_id" text NOT NULL,
	"ingress" text NOT NULL,
	"project_id" text NOT NULL,
	"reporter_id" text NOT NULL,
	"session_id" text NOT NULL,
	CONSTRAINT "project_test_session_identity_pk" PRIMARY KEY("project_id","ingress","reporter_id","external_session_id")
);
--> statement-breakpoint
ALTER TABLE "project_test_session" ADD COLUMN "fingerprint" text;--> statement-breakpoint
ALTER TABLE "project_test_session" ADD COLUMN "handoff_state_at_accept" text;--> statement-breakpoint
ALTER TABLE "project_test_session_identity" ADD CONSTRAINT "project_test_session_identity_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_session_identity" ADD CONSTRAINT "project_test_session_identity_session_id_project_test_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."project_test_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_test_session_identity_session_idx" ON "project_test_session_identity" USING btree ("session_id");