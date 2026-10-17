CREATE TABLE "workspace_company" (
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"workspace_id" text NOT NULL,
	CONSTRAINT "workspace_company_id_workspace_unique" UNIQUE("id","workspace_id"),
	CONSTRAINT "workspace_company_name_check" CHECK (length(btrim("workspace_company"."name")) between 1 and 255),
	CONSTRAINT "workspace_company_revision_check" CHECK ("workspace_company"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "workspace_contact" (
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"display_name" text,
	"id" text PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"workspace_id" text NOT NULL,
	CONSTRAINT "workspace_contact_id_workspace_unique" UNIQUE("id","workspace_id"),
	CONSTRAINT "workspace_contact_display_name_check" CHECK ("workspace_contact"."display_name" is null or length(btrim("workspace_contact"."display_name")) between 1 and 255),
	CONSTRAINT "workspace_contact_revision_check" CHECK ("workspace_contact"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "workspace_contact_company_affiliation" (
	"company_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"ended_at" timestamp,
	"id" text PRIMARY KEY NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"workspace_id" text NOT NULL,
	CONSTRAINT "workspace_contact_affiliation_period_check" CHECK ("workspace_contact_company_affiliation"."ended_at" is null or "workspace_contact_company_affiliation"."ended_at" >= "workspace_contact_company_affiliation"."started_at")
);
--> statement-breakpoint
CREATE TABLE "workspace_contact_email" (
	"contact_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"normalized_email" text NOT NULL,
	"workspace_id" text NOT NULL,
	CONSTRAINT "workspace_contact_email_normalized_check" CHECK ("workspace_contact_email"."normalized_email" = lower(btrim("workspace_contact_email"."normalized_email")) and length("workspace_contact_email"."normalized_email") between 3 and 320)
);
--> statement-breakpoint
CREATE TABLE "workspace_contact_persona" (
	"contact_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"document_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_company" ADD CONSTRAINT "workspace_company_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_contact" ADD CONSTRAINT "workspace_contact_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_contact_company_affiliation" ADD CONSTRAINT "workspace_contact_affiliation_contact_fk" FOREIGN KEY ("contact_id","workspace_id") REFERENCES "public"."workspace_contact"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_contact_company_affiliation" ADD CONSTRAINT "workspace_contact_affiliation_company_fk" FOREIGN KEY ("company_id","workspace_id") REFERENCES "public"."workspace_company"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_contact_email" ADD CONSTRAINT "workspace_contact_email_contact_fk" FOREIGN KEY ("contact_id","workspace_id") REFERENCES "public"."workspace_contact"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_contact_persona" ADD CONSTRAINT "workspace_contact_persona_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_contact_persona" ADD CONSTRAINT "workspace_contact_persona_contact_fk" FOREIGN KEY ("contact_id","workspace_id") REFERENCES "public"."workspace_contact"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_company_workspace_idx" ON "workspace_company" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_contact_workspace_idx" ON "workspace_contact" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_contact_affiliation_company_idx" ON "workspace_contact_company_affiliation" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_contact_affiliation_current_uidx" ON "workspace_contact_company_affiliation" USING btree ("contact_id") WHERE "workspace_contact_company_affiliation"."ended_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_contact_email_contact_alias_uidx" ON "workspace_contact_email" USING btree ("contact_id","normalized_email");--> statement-breakpoint
CREATE INDEX "workspace_contact_email_workspace_alias_idx" ON "workspace_contact_email" USING btree ("workspace_id","normalized_email");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_contact_persona_contact_document_uidx" ON "workspace_contact_persona" USING btree ("contact_id","document_id");--> statement-breakpoint
CREATE INDEX "workspace_contact_persona_document_idx" ON "workspace_contact_persona" USING btree ("document_id");