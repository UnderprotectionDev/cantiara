CREATE TABLE "project_release_checklist_item" (
	"checked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"project_id" text NOT NULL,
	"release_id" text NOT NULL,
	"text" text NOT NULL,
	CONSTRAINT "project_release_checklist_item_text_check" CHECK (length(btrim("project_release_checklist_item"."text")) between 1 and 500)
);
--> statement-breakpoint
CREATE TABLE "project_release_signal_close" (
	"closed_at" timestamp DEFAULT now() NOT NULL,
	"project_id" text NOT NULL,
	"release_id" text NOT NULL,
	"signal_id" text NOT NULL,
	CONSTRAINT "project_release_signal_close_pk" PRIMARY KEY("release_id","signal_id")
);
--> statement-breakpoint
ALTER TABLE "project_release_checklist_item" ADD CONSTRAINT "project_release_checklist_item_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_release_checklist_item" ADD CONSTRAINT "project_release_checklist_item_release_id_project_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."project_release"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_release_signal_close" ADD CONSTRAINT "project_release_signal_close_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_release_signal_close" ADD CONSTRAINT "project_release_signal_close_release_id_project_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."project_release"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_release_checklist_item_release_idx" ON "project_release_checklist_item" USING btree ("release_id","position");