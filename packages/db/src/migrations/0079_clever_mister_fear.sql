CREATE TABLE "focus_period_leftover_decision" (
	"period_id" text NOT NULL,
	"work_id" text NOT NULL,
	"destination" text NOT NULL,
	"target_period_id" text,
	CONSTRAINT "focus_period_leftover_destination_check" CHECK ("focus_period_leftover_decision"."destination" in ('Next period', 'Another period', 'Backlog', 'Abandon'))
);
--> statement-breakpoint
ALTER TABLE "focus_period_leftover_decision" ADD CONSTRAINT "focus_period_leftover_decision_period_id_focus_period_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."focus_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_period_leftover_decision" ADD CONSTRAINT "focus_period_leftover_decision_work_id_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_period_leftover_decision" ADD CONSTRAINT "focus_period_leftover_decision_target_period_id_focus_period_id_fk" FOREIGN KEY ("target_period_id") REFERENCES "public"."focus_period"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "focus_period_leftover_decision_uidx" ON "focus_period_leftover_decision" USING btree ("period_id","work_id");