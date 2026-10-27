CREATE TABLE "attention_signal_follow_up" (
	"account_id" text NOT NULL,
	"attempt_id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"fingerprint" text NOT NULL,
	"project_id" text NOT NULL,
	"signal_row_id" text NOT NULL,
	"source_group_id" text,
	"source_group_kind" text,
	"work_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attention_signal_follow_up" ADD CONSTRAINT "attention_signal_follow_up_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attention_signal_follow_up" ADD CONSTRAINT "attention_signal_follow_up_signal_row_id_attention_signal_id_fk" FOREIGN KEY ("signal_row_id") REFERENCES "public"."attention_signal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attention_signal_follow_up_work_uidx" ON "attention_signal_follow_up" USING btree ("work_id");--> statement-breakpoint
CREATE INDEX "attention_signal_follow_up_signal_idx" ON "attention_signal_follow_up" USING btree ("signal_row_id");