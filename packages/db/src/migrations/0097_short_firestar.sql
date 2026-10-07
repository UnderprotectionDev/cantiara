CREATE TABLE "project_last_visit" (
	"account_id" text NOT NULL,
	"project_id" text NOT NULL,
	"viewed_at" timestamp NOT NULL,
	CONSTRAINT "project_last_visit_account_id_project_id_pk" PRIMARY KEY("account_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "work_last_visit" (
	"account_id" text NOT NULL,
	"work_id" text NOT NULL,
	"viewed_at" timestamp NOT NULL,
	CONSTRAINT "work_last_visit_account_id_work_id_pk" PRIMARY KEY("account_id","work_id")
);
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "next_concrete_step" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "next_concrete_step_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "work" ADD COLUMN "next_concrete_step" text;--> statement-breakpoint
ALTER TABLE "work" ADD COLUMN "next_concrete_step_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "project_last_visit" ADD CONSTRAINT "project_last_visit_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_last_visit" ADD CONSTRAINT "project_last_visit_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_last_visit" ADD CONSTRAINT "work_last_visit_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_last_visit" ADD CONSTRAINT "work_last_visit_work_id_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;