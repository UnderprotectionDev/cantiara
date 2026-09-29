CREATE TABLE "project_risk" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"id" text PRIMARY KEY NOT NULL,
	"impact" text,
	"life" text DEFAULT 'Open' NOT NULL,
	"probability" text,
	"project_id" text NOT NULL,
	"rationale" text,
	"response" text,
	"revision" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_risk_life_check" CHECK ("project_risk"."life" in ('Open', 'Mitigating', 'Occurred', 'Resolved', 'Accepted')),
	CONSTRAINT "project_risk_revision_check" CHECK ("project_risk"."revision" >= 0),
	CONSTRAINT "project_risk_title_check" CHECK (length(btrim("project_risk"."title")) between 1 and 255)
);
--> statement-breakpoint
CREATE TABLE "project_assumption" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"life" text DEFAULT 'Open' NOT NULL,
	"project_id" text NOT NULL,
	"rationale" text,
	"revision" integer DEFAULT 0 NOT NULL,
	"statement" text NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_assumption_life_check" CHECK ("project_assumption"."life" in ('Open', 'Confirmed', 'Refuted', 'No longer applicable')),
	CONSTRAINT "project_assumption_revision_check" CHECK ("project_assumption"."revision" >= 0),
	CONSTRAINT "project_assumption_title_check" CHECK (length(btrim("project_assumption"."title")) between 1 and 255),
	CONSTRAINT "project_assumption_statement_check" CHECK (length(btrim("project_assumption"."statement")) between 1 and 100000)
);
--> statement-breakpoint
CREATE TABLE "project_open_question" (
	"answer" text,
	"context" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"life" text DEFAULT 'Open' NOT NULL,
	"project_id" text NOT NULL,
	"question" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_open_question_life_check" CHECK ("project_open_question"."life" in ('Open', 'Answered', 'No longer applicable')),
	CONSTRAINT "project_open_question_revision_check" CHECK ("project_open_question"."revision" >= 0),
	CONSTRAINT "project_open_question_title_check" CHECK (length(btrim("project_open_question"."title")) between 1 and 255),
	CONSTRAINT "project_open_question_question_check" CHECK (length(btrim("project_open_question"."question")) between 1 and 100000)
);
--> statement-breakpoint
ALTER TABLE "project_risk" ADD CONSTRAINT "project_risk_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assumption" ADD CONSTRAINT "project_assumption_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_open_question" ADD CONSTRAINT "project_open_question_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_risk_project_life_title_idx" ON "project_risk" USING btree ("project_id","life","title");--> statement-breakpoint
CREATE INDEX "project_assumption_project_life_title_idx" ON "project_assumption" USING btree ("project_id","life","title");--> statement-breakpoint
CREATE INDEX "project_open_question_project_life_title_idx" ON "project_open_question" USING btree ("project_id","life","title");