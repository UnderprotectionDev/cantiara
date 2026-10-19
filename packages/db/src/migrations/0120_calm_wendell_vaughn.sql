CREATE TABLE "screen" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"archived_at" timestamp,
	"trashed_at" timestamp,
	"redacted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "screen_title_check" CHECK (length(btrim("screen"."title")) between 1 and 255)
);
--> statement-breakpoint
CREATE TABLE "user_flow" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_flow_title_check" CHECK (length(btrim("user_flow"."title")) between 1 and 255),
	CONSTRAINT "user_flow_version_check" CHECK ("user_flow"."current_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "user_flow_version" (
	"id" text PRIMARY KEY NOT NULL,
	"user_flow_id" text NOT NULL,
	"version" integer NOT NULL,
	"document" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_flow_version_unique" UNIQUE("user_flow_id","version"),
	CONSTRAINT "user_flow_version_number_check" CHECK ("user_flow_version"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "screen" ADD CONSTRAINT "screen_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_flow" ADD CONSTRAINT "user_flow_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_flow_version" ADD CONSTRAINT "user_flow_version_user_flow_id_user_flow_id_fk" FOREIGN KEY ("user_flow_id") REFERENCES "public"."user_flow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "screen_project_idx" ON "screen" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "user_flow_project_idx" ON "user_flow" USING btree ("project_id");