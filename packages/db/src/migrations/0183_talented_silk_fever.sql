CREATE TABLE "external_surface_purge_request" (
	"surface_id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "external_surface_purge_request_status_check" CHECK ("external_surface_purge_request"."status" in ('Pending', 'Retrying', 'Done')),
	CONSTRAINT "external_surface_purge_request_attempts_check" CHECK ("external_surface_purge_request"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "external_surface_purge_request" ADD CONSTRAINT "external_surface_purge_request_surface_id_external_surface_id_fk" FOREIGN KEY ("surface_id") REFERENCES "public"."external_surface"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "external_surface_purge_request_due_idx" ON "external_surface_purge_request" USING btree ("status","next_attempt_at");