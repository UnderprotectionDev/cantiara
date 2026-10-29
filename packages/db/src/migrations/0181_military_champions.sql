CREATE TABLE "link_share_gate_attempt" (
	"key" text PRIMARY KEY NOT NULL,
	"failures" integer NOT NULL,
	"last_attempt_at" timestamp NOT NULL,
	"locked_until" timestamp
);
--> statement-breakpoint
CREATE TABLE "link_share_visitor_session" (
	"id" text PRIMARY KEY NOT NULL,
	"surface_id" text NOT NULL,
	"secret_hash" text NOT NULL,
	"access_epoch" integer NOT NULL,
	"created_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "external_surface" ADD COLUMN "access_epoch" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "external_surface" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "external_surface" ADD COLUMN "token_hash" text;--> statement-breakpoint
ALTER TABLE "link_share_visitor_session" ADD CONSTRAINT "link_share_visitor_session_surface_id_external_surface_id_fk" FOREIGN KEY ("surface_id") REFERENCES "public"."external_surface"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "link_share_gate_attempt_last_attempt_idx" ON "link_share_gate_attempt" USING btree ("last_attempt_at");--> statement-breakpoint
CREATE INDEX "link_share_visitor_session_surface_idx" ON "link_share_visitor_session" USING btree ("surface_id");--> statement-breakpoint
CREATE INDEX "link_share_visitor_session_expires_idx" ON "link_share_visitor_session" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "external_surface_token_hash_uidx" ON "external_surface" USING btree ("token_hash");