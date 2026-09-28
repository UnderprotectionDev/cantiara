CREATE TABLE "personal_reminder" (
	"account_id" text NOT NULL,
	"action" text NOT NULL,
	"cancelled_at" timestamp,
	"client_idempotency_key" text,
	"condition" text DEFAULT 'In any case' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"fire_at" timestamp NOT NULL,
	"fire_note" text,
	"id" text PRIMARY KEY NOT NULL,
	"section_id" text,
	"source_project_id" text,
	"source_record_id" text NOT NULL,
	"source_record_type" text NOT NULL,
	"status" text DEFAULT 'Planned' NOT NULL,
	"triggered_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "personal_reminder_action_check" CHECK ("personal_reminder"."action" in ('Remind me', 'Review Later')),
	CONSTRAINT "personal_reminder_condition_check" CHECK ("personal_reminder"."condition" in ('In any case', 'Only if still open')),
	CONSTRAINT "personal_reminder_source_type_check" CHECK ("personal_reminder"."source_record_type" in ('Project', 'Document', 'Work', 'Decision', 'Risk', 'Design', 'Source', 'Milestone', 'Project Release', 'Production Incident', 'Test Gap')),
	CONSTRAINT "personal_reminder_section_check" CHECK ("personal_reminder"."section_id" is null or ("personal_reminder"."action" = 'Review Later' and "personal_reminder"."source_record_type" = 'Document')),
	CONSTRAINT "personal_reminder_status_check" CHECK ((
        ("personal_reminder"."status" = 'Planned' and "personal_reminder"."cancelled_at" is null and "personal_reminder"."triggered_at" is null)
        or ("personal_reminder"."status" = 'Triggered' and "personal_reminder"."cancelled_at" is null and "personal_reminder"."triggered_at" is not null)
        or ("personal_reminder"."status" = 'Cancelled' and "personal_reminder"."cancelled_at" is not null and "personal_reminder"."triggered_at" is null)
      )),
	CONSTRAINT "personal_reminder_source_id_check" CHECK (length(btrim("personal_reminder"."source_record_id")) between 1 and 255)
);
--> statement-breakpoint
CREATE TABLE "personal_reminder_attention_signal" (
	"evaluation_note" text,
	"occurred_at" timestamp NOT NULL,
	"owner_account_id" text NOT NULL,
	"personal_reminder_id" text NOT NULL,
	"signal_id" text PRIMARY KEY NOT NULL,
	"signal_type" text NOT NULL,
	"source_path" text NOT NULL,
	"source_project_id" text,
	"source_record_id" text NOT NULL,
	"source_record_type" text NOT NULL,
	CONSTRAINT "personal_reminder_attention_signal_type_check" CHECK ("personal_reminder_attention_signal"."signal_type" in ('personal-reminder', 'review-later'))
);
--> statement-breakpoint
CREATE TABLE "work_not_now_trail" (
	"client_idempotency_key" text NOT NULL,
	"closed_at" timestamp,
	"closed_by" text,
	"closed_by_account_id" text,
	"closed_by_client_idempotency_key" text,
	"closed_by_payload_fingerprint" text,
	"condition" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_account_id" text NOT NULL,
	"grounds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"payload_fingerprint" text NOT NULL,
	"reason" text NOT NULL,
	"revision" integer NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"work_id" text NOT NULL,
	CONSTRAINT "work_not_now_trail_status_check" CHECK ("work_not_now_trail"."status" in ('Active', 'Reconsidered', 'Replaced')),
	CONSTRAINT "work_not_now_trail_close_state_check" CHECK ((
        "work_not_now_trail"."status" = 'Active'
        and "work_not_now_trail"."closed_at" is null
        and "work_not_now_trail"."closed_by" is null
        and "work_not_now_trail"."closed_by_account_id" is null
        and "work_not_now_trail"."closed_by_client_idempotency_key" is null
        and "work_not_now_trail"."closed_by_payload_fingerprint" is null
      ) or (
        "work_not_now_trail"."status" in ('Reconsidered', 'Replaced')
        and "work_not_now_trail"."closed_at" is not null
        and "work_not_now_trail"."closed_by_account_id" is not null
        and "work_not_now_trail"."closed_by_client_idempotency_key" is not null
        and "work_not_now_trail"."closed_by_payload_fingerprint" is not null
        and (
          ("work_not_now_trail"."status" = 'Reconsidered' and "work_not_now_trail"."closed_by" = 'Reconsidering')
          or ("work_not_now_trail"."status" = 'Replaced' and "work_not_now_trail"."closed_by" = 'Replaced')
        )
      )),
	CONSTRAINT "work_not_now_trail_revision_check" CHECK ("work_not_now_trail"."revision" > 0),
	CONSTRAINT "work_not_now_trail_reason_check" CHECK (length(btrim("work_not_now_trail"."reason")) between 1 and 500),
	CONSTRAINT "work_not_now_trail_condition_check" CHECK ("work_not_now_trail"."condition" is null or length("work_not_now_trail"."condition") <= 2000),
	CONSTRAINT "work_not_now_trail_grounds_check" CHECK (jsonb_typeof("work_not_now_trail"."grounds") = 'array'),
	CONSTRAINT "work_not_now_trail_payload_fingerprint_check" CHECK ("work_not_now_trail"."payload_fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "work_not_now_trail_close_fingerprint_check" CHECK ("work_not_now_trail"."closed_by_payload_fingerprint" is null or "work_not_now_trail"."closed_by_payload_fingerprint" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "personal_reminder" ADD CONSTRAINT "personal_reminder_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_reminder_attention_signal" ADD CONSTRAINT "personal_reminder_attention_signal_owner_account_id_user_id_fk" FOREIGN KEY ("owner_account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_reminder_attention_signal" ADD CONSTRAINT "personal_reminder_attention_signal_personal_reminder_id_personal_reminder_id_fk" FOREIGN KEY ("personal_reminder_id") REFERENCES "public"."personal_reminder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_not_now_trail" ADD CONSTRAINT "work_not_now_trail_closed_by_account_id_user_id_fk" FOREIGN KEY ("closed_by_account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_not_now_trail" ADD CONSTRAINT "work_not_now_trail_created_by_account_id_user_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_not_now_trail" ADD CONSTRAINT "work_not_now_trail_work_id_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "personal_reminder_account_source_idx" ON "personal_reminder" USING btree ("account_id","source_record_type","source_record_id","status");--> statement-breakpoint
CREATE INDEX "personal_reminder_account_fire_idx" ON "personal_reminder" USING btree ("account_id","status","fire_at");--> statement-breakpoint
CREATE UNIQUE INDEX "personal_reminder_account_idempotency_uidx" ON "personal_reminder" USING btree ("account_id","client_idempotency_key") WHERE "personal_reminder"."client_idempotency_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "personal_reminder_attention_signal_reminder_uidx" ON "personal_reminder_attention_signal" USING btree ("personal_reminder_id");--> statement-breakpoint
CREATE INDEX "personal_reminder_attention_signal_owner_idx" ON "personal_reminder_attention_signal" USING btree ("owner_account_id","occurred_at");--> statement-breakpoint
CREATE INDEX "work_not_now_trail_work_created_idx" ON "work_not_now_trail" USING btree ("work_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "work_not_now_trail_work_idempotency_uidx" ON "work_not_now_trail" USING btree ("work_id","client_idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "work_not_now_trail_work_revision_uidx" ON "work_not_now_trail" USING btree ("work_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "work_not_now_trail_work_close_idempotency_uidx" ON "work_not_now_trail" USING btree ("work_id","closed_by_client_idempotency_key") WHERE "work_not_now_trail"."closed_by_client_idempotency_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "work_not_now_trail_active_work_uidx" ON "work_not_now_trail" USING btree ("work_id") WHERE "work_not_now_trail"."status" = 'Active';