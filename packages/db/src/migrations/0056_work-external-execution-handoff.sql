CREATE TABLE "work_external_execution_handoff" (
	"client_idempotency_key" text NOT NULL,
	"constraints" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_account_id" text NOT NULL,
	"executor" text NOT NULL,
	"expected_output" text NOT NULL,
	"handoff_id" text PRIMARY KEY NOT NULL,
	"package_markdown" text NOT NULL,
	"package_produced_at" timestamp NOT NULL,
	"payload_fingerprint" text NOT NULL,
	"purpose" text NOT NULL,
	"selected_versions" jsonb NOT NULL,
	"status" text DEFAULT 'Open' NOT NULL,
	"work_id" text NOT NULL,
	CONSTRAINT "work_external_handoff_status_check" CHECK ("work_external_execution_handoff"."status" in ('Open', 'Result returned', 'Reconciled', 'Canceled')),
	CONSTRAINT "work_external_handoff_payload_fingerprint_check" CHECK ("work_external_execution_handoff"."payload_fingerprint" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "work_external_execution_handoff" ADD CONSTRAINT "work_external_execution_handoff_created_by_account_id_user_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_external_execution_handoff" ADD CONSTRAINT "work_external_execution_handoff_work_id_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_external_handoff_work_created_idx" ON "work_external_execution_handoff" USING btree ("work_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "work_external_handoff_work_idempotency_uidx" ON "work_external_execution_handoff" USING btree ("work_id","client_idempotency_key");