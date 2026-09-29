CREATE TABLE "focus_period_follow_up_work" (
	"period_id" text NOT NULL,
	"work_id" text NOT NULL,
	"learning" text NOT NULL,
	"learning_text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "focus_period_follow_up_work_pk" PRIMARY KEY("work_id"),
	CONSTRAINT "focus_period_follow_up_learning_check" CHECK ("focus_period_follow_up_work"."learning" in ('Keep', 'Change', 'Try next')),
	CONSTRAINT "focus_period_follow_up_learning_text_check" CHECK (length(btrim("focus_period_follow_up_work"."learning_text")) between 1 and 2000)
);
--> statement-breakpoint
ALTER TABLE "focus_period" ADD COLUMN "evaluation_keep" text;--> statement-breakpoint
ALTER TABLE "focus_period" ADD COLUMN "evaluation_change" text;--> statement-breakpoint
ALTER TABLE "focus_period" ADD COLUMN "evaluation_try_next" text;--> statement-breakpoint
ALTER TABLE "focus_period_follow_up_work" ADD CONSTRAINT "focus_period_follow_up_work_period_id_focus_period_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."focus_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_period_follow_up_work" ADD CONSTRAINT "focus_period_follow_up_work_work_id_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "focus_period_follow_up_work_period_idx" ON "focus_period_follow_up_work" USING btree ("period_id");--> statement-breakpoint
ALTER TABLE "focus_period" ADD CONSTRAINT "focus_period_evaluation_keep_check" CHECK ("focus_period"."evaluation_keep" is null or length(btrim("focus_period"."evaluation_keep")) between 1 and 2000);--> statement-breakpoint
ALTER TABLE "focus_period" ADD CONSTRAINT "focus_period_evaluation_change_check" CHECK ("focus_period"."evaluation_change" is null or length(btrim("focus_period"."evaluation_change")) between 1 and 2000);--> statement-breakpoint
ALTER TABLE "focus_period" ADD CONSTRAINT "focus_period_evaluation_try_next_check" CHECK ("focus_period"."evaluation_try_next" is null or length(btrim("focus_period"."evaluation_try_next")) between 1 and 2000);