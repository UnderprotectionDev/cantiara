CREATE TABLE "smart_collection_attention_signal" (
	"signal_id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"collection_id" text NOT NULL,
	"owner_account_id" text NOT NULL,
	"event_type" text NOT NULL,
	"signal_type" text DEFAULT 'smart-collection-entry' NOT NULL,
	"presentation" text DEFAULT 'Information Flow' NOT NULL,
	"membership_period" integer NOT NULL,
	"source_record_type" text NOT NULL,
	"source_record_id" text NOT NULL,
	"source_project_id" text,
	"source_record_name" text NOT NULL,
	"source_path" text NOT NULL,
	"reason" text NOT NULL,
	"occurred_at" timestamp NOT NULL,
	CONSTRAINT "smart_collection_attention_signal_type_check" CHECK ("smart_collection_attention_signal"."signal_type" = 'smart-collection-entry'),
	CONSTRAINT "smart_collection_attention_signal_presentation_check" CHECK ("smart_collection_attention_signal"."presentation" = 'Information Flow'),
	CONSTRAINT "smart_collection_attention_signal_event_check" CHECK ("smart_collection_attention_signal"."event_type" in ('entry', 'leave')),
	CONSTRAINT "smart_collection_attention_signal_period_check" CHECK ("smart_collection_attention_signal"."membership_period" >= 1),
	CONSTRAINT "smart_collection_attention_signal_source_type_check" CHECK ("smart_collection_attention_signal"."source_record_type" in ('Work', 'Document', 'Wiki Document', 'Decision', 'Risk', 'Assumption', 'Open Question', 'Milestone', 'Project Release', 'Production Incident'))
);
--> statement-breakpoint
CREATE TABLE "smart_collection_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"collection_id" text NOT NULL,
	"notify_on_leave" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "smart_collection_subscription_membership" (
	"subscription_id" text NOT NULL,
	"source_record_type" text NOT NULL,
	"source_record_id" text NOT NULL,
	"source_project_id" text,
	"source_record_title" text NOT NULL,
	"source_path" text NOT NULL,
	"membership_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"membership_period" integer DEFAULT 1 NOT NULL,
	"is_member" boolean DEFAULT true NOT NULL,
	"entered_at" timestamp NOT NULL,
	"left_at" timestamp,
	CONSTRAINT "smart_collection_subscription_membership_period_check" CHECK ("smart_collection_subscription_membership"."membership_period" >= 1),
	CONSTRAINT "smart_collection_subscription_membership_state_check" CHECK (("smart_collection_subscription_membership"."is_member" = true and "smart_collection_subscription_membership"."left_at" is null) or ("smart_collection_subscription_membership"."is_member" = false and "smart_collection_subscription_membership"."left_at" is not null)),
	CONSTRAINT "smart_collection_subscription_membership_source_type_check" CHECK ("smart_collection_subscription_membership"."source_record_type" in ('Work', 'Document', 'Wiki Document', 'Decision', 'Risk', 'Assumption', 'Open Question', 'Milestone', 'Project Release', 'Production Incident')),
	CONSTRAINT "smart_collection_subscription_membership_reasons_check" CHECK (jsonb_typeof("smart_collection_subscription_membership"."membership_reasons") = 'array')
);
--> statement-breakpoint
ALTER TABLE "smart_collection_attention_signal" ADD CONSTRAINT "smart_collection_attention_signal_collection_id_smart_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."smart_collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_collection_attention_signal" ADD CONSTRAINT "smart_collection_attention_signal_owner_account_id_user_id_fk" FOREIGN KEY ("owner_account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_collection_subscription" ADD CONSTRAINT "smart_collection_subscription_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_collection_subscription" ADD CONSTRAINT "smart_collection_subscription_collection_id_smart_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."smart_collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_collection_subscription_membership" ADD CONSTRAINT "smart_collection_subscription_membership_subscription_id_smart_collection_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."smart_collection_subscription"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "smart_collection_attention_signal_period_event_uidx" ON "smart_collection_attention_signal" USING btree ("subscription_id","source_record_type","source_record_id","membership_period","event_type");--> statement-breakpoint
CREATE INDEX "smart_collection_attention_signal_owner_idx" ON "smart_collection_attention_signal" USING btree ("owner_account_id","occurred_at");--> statement-breakpoint
CREATE INDEX "smart_collection_attention_signal_collection_idx" ON "smart_collection_attention_signal" USING btree ("collection_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "smart_collection_subscription_collection_uidx" ON "smart_collection_subscription" USING btree ("collection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "smart_collection_subscription_membership_record_uidx" ON "smart_collection_subscription_membership" USING btree ("subscription_id","source_record_type","source_record_id");--> statement-breakpoint
CREATE INDEX "smart_collection_subscription_membership_active_idx" ON "smart_collection_subscription_membership" USING btree ("subscription_id","is_member");