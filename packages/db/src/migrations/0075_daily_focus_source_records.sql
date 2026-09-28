CREATE TABLE "project_decision" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"decision" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"life" text DEFAULT 'Valid' NOT NULL,
	"project_id" text NOT NULL,
	"rationale" text,
	"revision" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_decision_life_check" CHECK ("project_decision"."life" in ('Valid', 'Superseded', 'Withdrawn')),
	CONSTRAINT "project_decision_revision_check" CHECK ("project_decision"."revision" >= 0),
	CONSTRAINT "project_decision_title_check" CHECK (length(btrim("project_decision"."title")) between 1 and 255),
	CONSTRAINT "project_decision_decision_check" CHECK (length(btrim("project_decision"."decision")) between 1 and 20000)
);
--> statement-breakpoint
CREATE TABLE "project_release" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"project_id" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version_label" text,
	CONSTRAINT "project_release_status_check" CHECK ("project_release"."status" in ('Draft', 'Preparing', 'Published', 'Cancelled')),
	CONSTRAINT "project_release_revision_check" CHECK ("project_release"."revision" >= 0),
	CONSTRAINT "project_release_name_check" CHECK (length(btrim("project_release"."name")) between 1 and 255),
	CONSTRAINT "project_release_version_label_check" CHECK ("project_release"."version_label" is null or length(btrim("project_release"."version_label")) <= 255)
);
--> statement-breakpoint
CREATE TABLE "production_incident" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"detected_how" text,
	"id" text PRIMARY KEY NOT NULL,
	"impact" text,
	"learning" text,
	"occurred_at" timestamp NOT NULL,
	"project_id" text NOT NULL,
	"resolution" text,
	"revision" integer DEFAULT 0 NOT NULL,
	"root_cause" text,
	"status" text DEFAULT 'Open' NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "production_incident_status_check" CHECK ("production_incident"."status" in ('Open', 'Watching', 'Resolved')),
	CONSTRAINT "production_incident_revision_check" CHECK ("production_incident"."revision" >= 0),
	CONSTRAINT "production_incident_title_check" CHECK (length(btrim("production_incident"."title")) between 1 and 255)
);
--> statement-breakpoint
ALTER TABLE "project_decision" ADD CONSTRAINT "project_decision_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_release" ADD CONSTRAINT "project_release_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_incident" ADD CONSTRAINT "production_incident_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_decision_project_life_title_idx" ON "project_decision" USING btree ("project_id","life","title");--> statement-breakpoint
CREATE INDEX "project_release_project_status_name_idx" ON "project_release" USING btree ("project_id","status","name");--> statement-breakpoint
CREATE INDEX "production_incident_project_status_occurred_at_idx" ON "production_incident" USING btree ("project_id","status","occurred_at");