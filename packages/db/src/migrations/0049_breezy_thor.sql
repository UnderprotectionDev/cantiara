CREATE TABLE "project_backlog_order" (
	"project_id" text PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"work_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "project_backlog_order_work_ids_check" CHECK (jsonb_typeof("project_backlog_order"."work_ids") = 'array'),
	CONSTRAINT "project_backlog_order_revision_check" CHECK ("project_backlog_order"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "prioritization_session" (
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"project_id" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"trashed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "prioritization_session_project_id_uidx" UNIQUE("project_id","id"),
	CONSTRAINT "prioritization_session_name_check" CHECK (length(btrim("prioritization_session"."name")) between 1 and 200),
	CONSTRAINT "prioritization_session_revision_check" CHECK ("prioritization_session"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "prioritization_session_work" (
	"id" text PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"project_id" text NOT NULL,
	"session_id" text NOT NULL,
	"work_id" text NOT NULL,
	CONSTRAINT "prioritization_session_work_position_check" CHECK ("prioritization_session_work"."position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "project_backlog_order" ADD CONSTRAINT "project_backlog_order_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prioritization_session" ADD CONSTRAINT "prioritization_session_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prioritization_session_work" ADD CONSTRAINT "prioritization_session_work_project_session_fk" FOREIGN KEY ("project_id","session_id") REFERENCES "public"."prioritization_session"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prioritization_session_project_idx" ON "prioritization_session" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "prioritization_session_work_project_session_idx" ON "prioritization_session_work" USING btree ("project_id","session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prioritization_session_work_session_position_uidx" ON "prioritization_session_work" USING btree ("session_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "prioritization_session_work_session_work_uidx" ON "prioritization_session_work" USING btree ("session_id","work_id");