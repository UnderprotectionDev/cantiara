CREATE TABLE "technical_diagram_viewport" (
	"account_id" text NOT NULL,
	"diagram_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"view_id" text DEFAULT '' NOT NULL,
	"viewport" jsonb NOT NULL,
	CONSTRAINT "technical_diagram_viewport_pk" PRIMARY KEY("account_id","diagram_id","view_id")
);
--> statement-breakpoint
ALTER TABLE "technical_diagram_viewport" ADD CONSTRAINT "technical_diagram_viewport_diagram_id_technical_diagram_id_fk" FOREIGN KEY ("diagram_id") REFERENCES "public"."technical_diagram"("id") ON DELETE cascade ON UPDATE no action;