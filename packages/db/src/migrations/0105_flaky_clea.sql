CREATE TABLE "source" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"revision" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "source_revision_check" CHECK ("source"."revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "source_version" (
	"source_id" text NOT NULL,
	"revision" integer NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"accessed_at" timestamp with time zone NOT NULL,
	"captured_content" text NOT NULL,
	"provider" text,
	"external_record_type" text,
	"external_id" text,
	"saved_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "source_version_source_id_revision_pk" PRIMARY KEY("source_id","revision"),
	CONSTRAINT "source_version_revision_check" CHECK ("source_version"."revision" > 0),
	CONSTRAINT "source_version_url_check" CHECK (length("source_version"."url") between 1 and 8192 and "source_version"."url" ~ '^https?://'),
	CONSTRAINT "source_version_title_check" CHECK (length(btrim("source_version"."title")) between 1 and 255),
	CONSTRAINT "source_version_content_check" CHECK (length("source_version"."captured_content") <= 100000),
	CONSTRAINT "source_version_provider_check" CHECK ("source_version"."provider" is null or length(btrim("source_version"."provider")) between 1 and 255),
	CONSTRAINT "source_version_external_type_check" CHECK ("source_version"."external_record_type" is null or length(btrim("source_version"."external_record_type")) between 1 and 255),
	CONSTRAINT "source_version_external_id_check" CHECK ("source_version"."external_id" is null or length(btrim("source_version"."external_id")) between 1 and 255)
);
--> statement-breakpoint
ALTER TABLE "source" ADD CONSTRAINT "source_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_version" ADD CONSTRAINT "source_version_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "source_project_idx" ON "source" USING btree ("project_id");