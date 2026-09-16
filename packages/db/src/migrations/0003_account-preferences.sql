CREATE TABLE "account_preferences" (
	"account_id" text PRIMARY KEY NOT NULL,
	"locale" text DEFAULT 'en-GB' NOT NULL,
	"time_zone" text DEFAULT 'Europe/Istanbul' NOT NULL,
	"date_format" text DEFAULT 'locale' NOT NULL,
	"first_day_of_week" text DEFAULT 'Monday' NOT NULL,
	"appearance" text DEFAULT 'Dark' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_preferences" ADD CONSTRAINT "account_preferences_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;