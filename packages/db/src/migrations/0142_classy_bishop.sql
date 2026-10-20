CREATE TABLE "project_wall_viewport" (
	"account_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"viewport" jsonb NOT NULL,
	"wall_id" text NOT NULL,
	CONSTRAINT "project_wall_viewport_pk" PRIMARY KEY("account_id","wall_id")
);
--> statement-breakpoint
ALTER TABLE "project_wall_item" ADD COLUMN "z_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "project_wall_viewport" ADD CONSTRAINT "project_wall_viewport_wall_id_project_wall_id_fk" FOREIGN KEY ("wall_id") REFERENCES "public"."project_wall"("id") ON DELETE cascade ON UPDATE no action;