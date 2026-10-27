CREATE TABLE "attention_signal" (
	"account_id" text NOT NULL,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"event_id" text NOT NULL,
	"group_id" text NOT NULL,
	"group_kind" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"project_id" text,
	"read_at" timestamp,
	"reason" text NOT NULL,
	"signal_id" text NOT NULL,
	"target_id" text NOT NULL,
	CONSTRAINT "attention_signal_signal_id_check" CHECK ("attention_signal"."signal_id" in ('due-date', 'reappear-date', 'personal-reminder', 'review-later', 'open-risk', 'work-blocked', 'source-version-in-use', 'external-run-returned', 'release-observation-missing', 'github-check-failed', 'work-pr-status-conflict', 'unlinked-open-pr', 'published-release-open-scope', 'automation-failed', 'public-roadmap-review-due', 'unreviewed-test-report', 'test-result-conflict', 'handoff-result-after-cancel', 'smart-collection-entry', 'github-activity'))
);
--> statement-breakpoint
ALTER TABLE "attention_signal" ADD CONSTRAINT "attention_signal_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attention_signal_identity_uidx" ON "attention_signal" USING btree ("account_id","signal_id","event_id","target_id");--> statement-breakpoint
CREATE INDEX "attention_signal_account_group_idx" ON "attention_signal" USING btree ("account_id","group_kind","group_id");