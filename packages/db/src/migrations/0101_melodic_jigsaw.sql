ALTER TABLE "project_decision" ADD CONSTRAINT "project_decision_project_id_uidx" UNIQUE("project_id","id");--> statement-breakpoint
CREATE TABLE "decision_supersession" (
	"predecessor_id" text PRIMARY KEY NOT NULL,
	"successor_id" text NOT NULL,
	"project_id" text NOT NULL,
	"rationale" text,
	"actor_id" text NOT NULL,
	"occurred_at" timestamp NOT NULL,
	CONSTRAINT "decision_supersession_self_check" CHECK ("decision_supersession"."predecessor_id" <> "decision_supersession"."successor_id")
);
--> statement-breakpoint
ALTER TABLE "decision_supersession" ADD CONSTRAINT "decision_supersession_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_supersession" ADD CONSTRAINT "decision_supersession_project_id_predecessor_id_project_decision_project_id_id_fk" FOREIGN KEY ("project_id","predecessor_id") REFERENCES "public"."project_decision"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_supersession" ADD CONSTRAINT "decision_supersession_project_id_successor_id_project_decision_project_id_id_fk" FOREIGN KEY ("project_id","successor_id") REFERENCES "public"."project_decision"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "decision_supersession_project_idx" ON "decision_supersession" USING btree ("project_id");--> statement-breakpoint
