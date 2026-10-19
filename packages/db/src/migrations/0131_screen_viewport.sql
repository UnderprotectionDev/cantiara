CREATE TABLE "account_screen_viewport" (
	"account_id" text NOT NULL,
	"center_x" double precision NOT NULL,
	"center_y" double precision NOT NULL,
	"collapsed_groups" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"screen_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"zoom" double precision NOT NULL,
	CONSTRAINT "account_screen_viewport_pk" PRIMARY KEY("account_id","screen_id"),
	CONSTRAINT "account_screen_viewport_zoom_check" CHECK ("account_screen_viewport"."zoom" between 0.1 and 4)
);
--> statement-breakpoint
ALTER TABLE "account_screen_viewport" ADD CONSTRAINT "account_screen_viewport_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_screen_viewport" ADD CONSTRAINT "account_screen_viewport_screen_id_project_screen_id_fk" FOREIGN KEY ("screen_id") REFERENCES "public"."project_screen"("id") ON DELETE cascade ON UPDATE no action;