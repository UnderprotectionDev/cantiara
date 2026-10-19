CREATE TABLE "user_flow_record_bind" (
	"id" text PRIMARY KEY NOT NULL,
	"user_flow_id" text NOT NULL,
	"node_id" text NOT NULL,
	"record_type" text NOT NULL,
	"record_id" text NOT NULL,
	"origin_version" integer NOT NULL,
	"bound_version" integer NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"actor_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_flow_record_bind_type_check" CHECK ("user_flow_record_bind"."record_type" in ('Work', 'Decision', 'Risk', 'Open Question')),
	CONSTRAINT "user_flow_record_bind_version_check" CHECK ("user_flow_record_bind"."origin_version" >= 1 and "user_flow_record_bind"."bound_version" >= "user_flow_record_bind"."origin_version"),
	CONSTRAINT "user_flow_record_bind_revision_check" CHECK ("user_flow_record_bind"."revision" >= 1)
);
--> statement-breakpoint
CREATE TABLE "user_flow_record_bind_rebind" (
	"id" text PRIMARY KEY NOT NULL,
	"bind_id" text NOT NULL,
	"from_version" integer NOT NULL,
	"to_version" integer NOT NULL,
	"actor_id" text NOT NULL,
	"rebound_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_flow_record_bind_rebind_version_check" CHECK ("user_flow_record_bind_rebind"."to_version" > "user_flow_record_bind_rebind"."from_version")
);
--> statement-breakpoint
CREATE TABLE "user_flow_template" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"structure" jsonb NOT NULL,
	"actor_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_flow_template_name_check" CHECK (length(btrim("user_flow_template"."name")) between 1 and 255)
);
--> statement-breakpoint
ALTER TABLE "user_flow_record_bind" ADD CONSTRAINT "user_flow_record_bind_user_flow_id_user_flow_id_fk" FOREIGN KEY ("user_flow_id") REFERENCES "public"."user_flow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_flow_record_bind_rebind" ADD CONSTRAINT "user_flow_record_bind_rebind_bind_id_user_flow_record_bind_id_fk" FOREIGN KEY ("bind_id") REFERENCES "public"."user_flow_record_bind"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_flow_template" ADD CONSTRAINT "user_flow_template_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_flow_record_bind_record_uidx" ON "user_flow_record_bind" USING btree ("record_type","record_id");--> statement-breakpoint
CREATE INDEX "user_flow_record_bind_flow_node_idx" ON "user_flow_record_bind" USING btree ("user_flow_id","node_id");--> statement-breakpoint
CREATE INDEX "user_flow_record_bind_rebind_bind_idx" ON "user_flow_record_bind_rebind" USING btree ("bind_id");--> statement-breakpoint
CREATE INDEX "user_flow_template_workspace_idx" ON "user_flow_template" USING btree ("workspace_id");