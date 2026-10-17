CREATE TABLE "evidence_binding_history" (
	"id" text PRIMARY KEY NOT NULL,
	"evidence_binding_id" text NOT NULL,
	"binding_revision" integer NOT NULL,
	"previous_role" text NOT NULL,
	"previous_interpretation" text,
	"role" text NOT NULL,
	"interpretation" text,
	"actor_id" text NOT NULL,
	"changed_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evidence_binding" ADD COLUMN "interpretation" text;--> statement-breakpoint
ALTER TABLE "evidence_binding_history" ADD CONSTRAINT "evidence_binding_history_evidence_binding_id_evidence_binding_id_fk" FOREIGN KEY ("evidence_binding_id") REFERENCES "public"."evidence_binding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evidence_binding_history_binding_idx" ON "evidence_binding_history" USING btree ("evidence_binding_id","binding_revision");