ALTER TABLE "focus_period_leftover_decision" DROP CONSTRAINT "focus_period_leftover_decision_target_period_id_focus_period_id_fk";
--> statement-breakpoint
ALTER TABLE "focus_period_leftover_decision" ADD CONSTRAINT "focus_period_leftover_decision_target_period_id_focus_period_id_fk" FOREIGN KEY ("target_period_id") REFERENCES "public"."focus_period"("id") ON DELETE set null ON UPDATE no action;