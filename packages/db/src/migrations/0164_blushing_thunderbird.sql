CREATE TABLE "migration_artifact" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"diagram_id" text NOT NULL,
	"source_version_id" text NOT NULL,
	"target_version_id" text NOT NULL,
	"source_model_hash" text NOT NULL,
	"target_model_hash" text NOT NULL,
	"generator_version" text NOT NULL,
	"up_sql" text NOT NULL,
	"down_sql" text,
	"static_validation" jsonb NOT NULL,
	"edit_diff" jsonb NOT NULL,
	"operations" jsonb NOT NULL,
	"warning_manifest" jsonb NOT NULL,
	"digest" text NOT NULL,
	"supersedes_artifact_id" text,
	"client_idempotency_key" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "migration_artifact_key_unique" UNIQUE("account_id","client_idempotency_key"),
	CONSTRAINT "migration_artifact_digest_check" CHECK ("migration_artifact"."digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "migration_artifact" ADD CONSTRAINT "migration_artifact_diagram_id_technical_diagram_id_fk" FOREIGN KEY ("diagram_id") REFERENCES "public"."technical_diagram"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_artifact" ADD CONSTRAINT "migration_artifact_source_version_id_diagram_version_id_fk" FOREIGN KEY ("source_version_id") REFERENCES "public"."diagram_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_artifact" ADD CONSTRAINT "migration_artifact_target_version_id_diagram_version_id_fk" FOREIGN KEY ("target_version_id") REFERENCES "public"."diagram_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "migration_artifact_diagram_idx" ON "migration_artifact" USING btree ("diagram_id");--> statement-breakpoint
CREATE INDEX "migration_artifact_supersedes_idx" ON "migration_artifact" USING btree ("supersedes_artifact_id");