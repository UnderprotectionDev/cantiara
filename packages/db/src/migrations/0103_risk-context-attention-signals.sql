CREATE TABLE "risk_attention_signal" (
	"signal_id" text PRIMARY KEY NOT NULL,
	"source_risk_id" text NOT NULL,
	"project_id" text NOT NULL,
	"signal_type" text DEFAULT 'open-risk' NOT NULL,
	"presentation" text DEFAULT 'Action Required' NOT NULL,
	"source_event" jsonb NOT NULL,
	"impact" text,
	"probability" text,
	"source_path" text NOT NULL,
	"occurred_at" timestamp NOT NULL,
	CONSTRAINT "risk_attention_signal_type_check" CHECK ("risk_attention_signal"."signal_type" = 'open-risk'),
	CONSTRAINT "risk_attention_signal_presentation_check" CHECK ("risk_attention_signal"."presentation" = 'Action Required'),
	CONSTRAINT "risk_attention_signal_event_check" CHECK ("risk_attention_signal"."source_event"->>'type' in ('entered-open', 'related-context'))
);
--> statement-breakpoint
CREATE TABLE "risk_context_relation" (
	"id" text PRIMARY KEY NOT NULL,
	"risk_id" text NOT NULL,
	"project_release_id" text,
	"focus_period_id" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "risk_context_relation_target_check" CHECK (num_nonnulls("risk_context_relation"."project_release_id", "risk_context_relation"."focus_period_id") = 1),
	CONSTRAINT "risk_context_relation_revision_check" CHECK ("risk_context_relation"."revision" >= 1)
);
--> statement-breakpoint
ALTER TABLE "risk_attention_signal" ADD CONSTRAINT "risk_attention_signal_source_risk_id_project_risk_id_fk" FOREIGN KEY ("source_risk_id") REFERENCES "public"."project_risk"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_attention_signal" ADD CONSTRAINT "risk_attention_signal_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_context_relation" ADD CONSTRAINT "risk_context_relation_risk_id_project_risk_id_fk" FOREIGN KEY ("risk_id") REFERENCES "public"."project_risk"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_context_relation" ADD CONSTRAINT "risk_context_relation_project_release_id_project_release_id_fk" FOREIGN KEY ("project_release_id") REFERENCES "public"."project_release"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_context_relation" ADD CONSTRAINT "risk_context_relation_focus_period_id_focus_period_id_fk" FOREIGN KEY ("focus_period_id") REFERENCES "public"."focus_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "risk_attention_signal_project_idx" ON "risk_attention_signal" USING btree ("project_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "risk_context_relation_release_uidx" ON "risk_context_relation" USING btree ("risk_id","project_release_id");--> statement-breakpoint
CREATE UNIQUE INDEX "risk_context_relation_period_uidx" ON "risk_context_relation" USING btree ("risk_id","focus_period_id");