CREATE TABLE "work" (
	"closure_result" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"number" integer NOT NULL,
	"project_id" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'Not Started' NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "work_number_check" CHECK ("work"."number" >= 1),
	CONSTRAINT "work_revision_check" CHECK ("work"."revision" >= 0),
	CONSTRAINT "work_title_check" CHECK (length(btrim("work"."title")) > 0),
	CONSTRAINT "work_type_check" CHECK ("work"."type" in ('Feature', 'Bug', 'Task', 'Research', 'Improvement')),
	CONSTRAINT "work_status_check" CHECK ("work"."status" in ('Not Started', 'In Progress', 'Blocked', 'Closed')),
	CONSTRAINT "work_closure_result_check" CHECK ("work"."closure_result" is null or "work"."closure_result" in ('Completed', 'Abandoned'))
);
--> statement-breakpoint
CREATE TABLE "work_key_allocation" (
	"client_idempotency_key" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"number" integer NOT NULL,
	"project_id" text NOT NULL,
	"reserved_at" timestamp DEFAULT now() NOT NULL,
	"short_code" text NOT NULL,
	"work_id" text NOT NULL,
	CONSTRAINT "work_key_allocation_number_check" CHECK ("work_key_allocation"."number" >= 1)
);
--> statement-breakpoint
ALTER TABLE "work" ADD CONSTRAINT "work_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_key_allocation" ADD CONSTRAINT "work_key_allocation_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_project_idx" ON "work" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_project_number_uidx" ON "work" USING btree ("project_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "work_project_key_uidx" ON "work" USING btree ("project_id","key");--> statement-breakpoint
CREATE INDEX "work_key_allocation_work_idx" ON "work_key_allocation" USING btree ("work_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_key_allocation_project_client_uidx" ON "work_key_allocation" USING btree ("project_id","client_idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "work_key_allocation_project_number_uidx" ON "work_key_allocation" USING btree ("project_id","number");