CREATE TABLE "external_surface" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"project_id" text,
	"document_id" text,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_surface_snapshot_revision" (
	"id" text PRIMARY KEY NOT NULL,
	"surface_id" text NOT NULL,
	"revision" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "external_surface_snapshot_revision_check" CHECK ("external_surface_snapshot_revision"."revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "file_attachment" ADD COLUMN "owner_document_id" text;--> statement-breakpoint
ALTER TABLE "external_surface" ADD CONSTRAINT "external_surface_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_surface" ADD CONSTRAINT "external_surface_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_surface" ADD CONSTRAINT "external_surface_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_surface_snapshot_revision" ADD CONSTRAINT "external_surface_snapshot_revision_surface_id_external_surface_id_fk" FOREIGN KEY ("surface_id") REFERENCES "public"."external_surface"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "external_surface_snapshot_revision_uidx" ON "external_surface_snapshot_revision" USING btree ("surface_id","revision");--> statement-breakpoint
ALTER TABLE "file_attachment" ADD CONSTRAINT "file_attachment_owner_document_id_document_id_fk" FOREIGN KEY ("owner_document_id") REFERENCES "public"."document"("id") ON DELETE set null ON UPDATE no action;