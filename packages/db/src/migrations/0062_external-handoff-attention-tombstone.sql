ALTER TABLE "work_external_execution_handoff_attention_signal" ADD COLUMN "owner_account_id" text;
--> statement-breakpoint
UPDATE "work_external_execution_handoff_attention_signal" AS signal
SET "owner_account_id" = handoff."created_by_account_id"
FROM "work_external_execution_handoff" AS handoff
WHERE signal."handoff_id" = handoff."handoff_id";
--> statement-breakpoint
ALTER TABLE "work_external_execution_handoff_attention_signal" ALTER COLUMN "owner_account_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "work_external_execution_handoff_attention_signal" ADD CONSTRAINT "work_external_execution_handoff_attention_signal_owner_account_id_user_id_fk" FOREIGN KEY ("owner_account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "work_external_execution_handoff_attention_signal" DROP CONSTRAINT "work_external_execution_handoff_attention_signal_handoff_id_work_external_execution_handoff_handoff_id_fk";
--> statement-breakpoint
ALTER TABLE "work_external_execution_handoff_attention_signal" DROP CONSTRAINT "work_external_execution_handoff_attention_signal_source_event_id_mutation_history_id_fk";
--> statement-breakpoint
ALTER TABLE "work_external_execution_handoff_attention_signal" DROP CONSTRAINT "work_external_execution_handoff_attention_signal_source_work_id_work_id_fk";
