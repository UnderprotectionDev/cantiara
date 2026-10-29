CREATE TABLE "build_in_public_slug" (
	"canonical" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"slug" text NOT NULL,
	"surface_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	CONSTRAINT "build_in_public_slug_pk" PRIMARY KEY("workspace_id","slug"),
	CONSTRAINT "build_in_public_slug_check" CHECK ("build_in_public_slug"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length("build_in_public_slug"."slug") <= 80)
);
--> statement-breakpoint
ALTER TABLE "build_in_public_work_copy" ADD COLUMN "due_date_presentation" text DEFAULT 'Hidden' NOT NULL;--> statement-breakpoint
ALTER TABLE "build_in_public_slug" ADD CONSTRAINT "build_in_public_slug_surface_id_external_surface_id_fk" FOREIGN KEY ("surface_id") REFERENCES "public"."external_surface"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_in_public_slug" ADD CONSTRAINT "build_in_public_slug_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "build_in_public_slug_canonical_uidx" ON "build_in_public_slug" USING btree ("surface_id") WHERE "build_in_public_slug"."canonical";--> statement-breakpoint
ALTER TABLE "build_in_public_work_copy" ADD CONSTRAINT "build_in_public_work_copy_due_date_check" CHECK ("build_in_public_work_copy"."due_date_presentation" in ('Full date', 'Month', 'Quarter', 'Hidden'));