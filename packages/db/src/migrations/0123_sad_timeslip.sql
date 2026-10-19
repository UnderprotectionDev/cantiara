CREATE TABLE "moodboard_personal_view" (
	"account_id" text NOT NULL,
	"center_x" double precision,
	"center_y" double precision,
	"collapsed" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"moodboard_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"zoom" double precision,
	CONSTRAINT "moodboard_personal_view_pk" PRIMARY KEY("account_id","moodboard_id"),
	CONSTRAINT "moodboard_personal_view_viewport_check" CHECK (("moodboard_personal_view"."center_x" is null and "moodboard_personal_view"."center_y" is null and "moodboard_personal_view"."zoom" is null) or ("moodboard_personal_view"."center_x" is not null and "moodboard_personal_view"."center_y" is not null and "moodboard_personal_view"."zoom" between 0.05 and 4))
);
--> statement-breakpoint
ALTER TABLE "moodboard_personal_view" ADD CONSTRAINT "moodboard_personal_view_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moodboard_personal_view" ADD CONSTRAINT "moodboard_personal_view_moodboard_id_moodboard_id_fk" FOREIGN KEY ("moodboard_id") REFERENCES "public"."moodboard"("id") ON DELETE cascade ON UPDATE no action;