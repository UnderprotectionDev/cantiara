CREATE TABLE "completion_effect_preferences" (
	"account_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"theme" text DEFAULT 'Calm' NOT NULL,
	"palette" text DEFAULT 'Haze' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "completion_effect_preferences_catalog_check" CHECK (("completion_effect_preferences"."theme" = 'Calm' AND "completion_effect_preferences"."palette" IN ('Haze', 'Pebble', 'Linen', 'Moss')) OR ("completion_effect_preferences"."theme" = 'Weave' AND "completion_effect_preferences"."palette" IN ('Loom', 'Cord', 'Lattice', 'Knot')) OR ("completion_effect_preferences"."theme" = 'Arc' AND "completion_effect_preferences"."palette" IN ('Gleam', 'Trace', 'Halo', 'Span')) OR ("completion_effect_preferences"."theme" = 'Nova' AND "completion_effect_preferences"."palette" IN ('Ember', 'Pulse', 'Orbit', 'Flare')))
);
--> statement-breakpoint
ALTER TABLE "completion_effect_preferences" ADD CONSTRAINT "completion_effect_preferences_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;