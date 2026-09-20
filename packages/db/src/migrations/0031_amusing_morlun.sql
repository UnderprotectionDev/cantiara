CREATE TABLE "workspace_tag" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"workspace_id" text NOT NULL,
	CONSTRAINT "workspace_tag_name_check" CHECK (length(btrim("workspace_tag"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "workspace_tag_assignment" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"record_id" text NOT NULL,
	"record_type" text NOT NULL,
	"tag_id" text NOT NULL,
	CONSTRAINT "workspace_tag_assignment_record_type_check" CHECK ("workspace_tag_assignment"."record_type" in ('Work'))
);
--> statement-breakpoint
ALTER TABLE "workspace_tag" ADD CONSTRAINT "workspace_tag_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_tag_assignment" ADD CONSTRAINT "workspace_tag_assignment_tag_id_workspace_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."workspace_tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_tag_workspace_idx" ON "workspace_tag" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_tag_workspace_name_uidx" ON "workspace_tag" USING btree ("workspace_id","name_key");--> statement-breakpoint
CREATE INDEX "workspace_tag_assignment_record_idx" ON "workspace_tag_assignment" USING btree ("record_type","record_id");--> statement-breakpoint
CREATE INDEX "workspace_tag_assignment_tag_idx" ON "workspace_tag_assignment" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_tag_assignment_tag_record_uidx" ON "workspace_tag_assignment" USING btree ("tag_id","record_type","record_id");