CREATE TABLE "work_retired_identity" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"merge_id" text NOT NULL,
	"project_id" text NOT NULL,
	"retired_at" timestamp DEFAULT now() NOT NULL,
	"surviving_work_id" text NOT NULL,
	CONSTRAINT "work_retired_identity_key_check" CHECK (length(btrim("work_retired_identity"."key")) > 0)
);
--> statement-breakpoint
ALTER TABLE "work_retired_identity" ADD CONSTRAINT "work_retired_identity_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_retired_identity" ADD CONSTRAINT "work_retired_identity_surviving_work_id_work_id_fk" FOREIGN KEY ("surviving_work_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_retired_identity_survivor_idx" ON "work_retired_identity" USING btree ("surviving_work_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_retired_identity_project_key_uidx" ON "work_retired_identity" USING btree ("project_id","key");