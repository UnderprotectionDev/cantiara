CREATE TABLE "workspace_product_gap" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"scope" text,
	"status" text DEFAULT 'Open' NOT NULL,
	"status_changed_at" timestamp DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"unmet_need" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"workspace_id" text NOT NULL,
	CONSTRAINT "workspace_product_gap_status_check" CHECK ("workspace_product_gap"."status" in ('Open', 'Evaluating', 'Met', 'Conscious boundary')),
	CONSTRAINT "workspace_product_gap_title_check" CHECK (length(btrim("workspace_product_gap"."title")) between 1 and 255),
	CONSTRAINT "workspace_product_gap_unmet_need_check" CHECK (length(btrim("workspace_product_gap"."unmet_need")) >= 1)
);
--> statement-breakpoint
CREATE TABLE "workspace_product_gap_link" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"gap_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"kind" text DEFAULT 'Related' NOT NULL,
	"position" integer NOT NULL,
	"target_id" text NOT NULL,
	"target_type" text NOT NULL,
	CONSTRAINT "workspace_product_gap_link_type_check" CHECK ("workspace_product_gap_link"."target_type" in ('Project', 'Work', 'Feature', 'Decision')),
	CONSTRAINT "workspace_product_gap_link_kind_check" CHECK ("workspace_product_gap_link"."kind" in ('Related', 'Follow-up'))
);
--> statement-breakpoint
ALTER TABLE "workspace_product_gap" ADD CONSTRAINT "workspace_product_gap_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_product_gap_link" ADD CONSTRAINT "workspace_product_gap_link_gap_fk" FOREIGN KEY ("gap_id") REFERENCES "public"."workspace_product_gap"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_product_gap_workspace_idx" ON "workspace_product_gap" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_product_gap_link_gap_idx" ON "workspace_product_gap_link" USING btree ("gap_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_product_gap_link_target_unique" ON "workspace_product_gap_link" USING btree ("gap_id","target_type","target_id");