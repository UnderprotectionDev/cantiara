CREATE TABLE "project_public_roadmap_review" (
	"interval_days" integer NOT NULL,
	"project_id" text PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_public_roadmap_review_days_check" CHECK ("project_public_roadmap_review"."interval_days" between 7 and 180)
);
--> statement-breakpoint
ALTER TABLE "project_public_roadmap_review" ADD CONSTRAINT "project_public_roadmap_review_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;