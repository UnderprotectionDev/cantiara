CREATE TABLE "work_external_execution_handoff_attention_signal" (
	"closed_at" timestamp,
	"handoff_id" text NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"signal_id" text PRIMARY KEY NOT NULL,
	"signal_type" text NOT NULL,
	"source_event_id" text NOT NULL,
	"source_work_id" text NOT NULL,
	CONSTRAINT "work_external_handoff_attention_signal_type_check" CHECK ("work_external_execution_handoff_attention_signal"."signal_type" = 'external-run-returned'),
	CONSTRAINT "work_external_handoff_attention_signal_id_check" CHECK ("work_external_execution_handoff_attention_signal"."signal_id" = 'external-run-returned:' || "work_external_execution_handoff_attention_signal"."handoff_id")
);
--> statement-breakpoint
ALTER TABLE "work_external_execution_handoff_attention_signal" ADD CONSTRAINT "work_external_execution_handoff_attention_signal_handoff_id_work_external_execution_handoff_handoff_id_fk" FOREIGN KEY ("handoff_id") REFERENCES "public"."work_external_execution_handoff"("handoff_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_external_execution_handoff_attention_signal" ADD CONSTRAINT "work_external_execution_handoff_attention_signal_source_event_id_mutation_history_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "public"."mutation_history"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_external_execution_handoff_attention_signal" ADD CONSTRAINT "work_external_execution_handoff_attention_signal_source_work_id_work_id_fk" FOREIGN KEY ("source_work_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "work_external_handoff_attention_signal_handoff_uidx" ON "work_external_execution_handoff_attention_signal" USING btree ("handoff_id");--> statement-breakpoint
CREATE INDEX "work_external_handoff_attention_signal_work_idx" ON "work_external_execution_handoff_attention_signal" USING btree ("source_work_id");
--> statement-breakpoint
INSERT INTO "work_external_execution_handoff_attention_signal" (
	"closed_at",
	"handoff_id",
	"occurred_at",
	"signal_id",
	"signal_type",
	"source_event_id",
	"source_work_id"
)
SELECT
	NULL,
	handoff."handoff_id",
	return_event."occurred_at",
	'external-run-returned:' || handoff."handoff_id",
	'external-run-returned',
	return_event."id",
	handoff."work_id"
FROM "work_external_execution_handoff" AS handoff
JOIN "mutation_history" AS return_event
	ON return_event."target_id" = handoff."work_id"
	AND return_event."next_value"->>'kind' = 'external-execution-handoff-history-event'
	AND return_event."next_value"->>'eventType' = 'external-execution-handoff-return-recorded'
	AND return_event."next_value"->>'handoffId' = handoff."handoff_id"
WHERE handoff."status" = 'Result returned'
	AND handoff."result" IS NOT NULL
ON CONFLICT ("handoff_id") DO NOTHING;
