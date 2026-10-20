CREATE TABLE "project_wall_focus_step" (
	"item_id" text NOT NULL,
	"position" integer NOT NULL,
	"wall_id" text NOT NULL,
	CONSTRAINT "project_wall_focus_step_pk" PRIMARY KEY("wall_id","item_id"),
	CONSTRAINT "project_wall_focus_step_position_check" CHECK ("project_wall_focus_step"."position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "project_wall_item" DROP CONSTRAINT "project_wall_item_source_type_check";--> statement-breakpoint
ALTER TABLE "project_wall_item" ADD COLUMN "diagram_view_id" text;--> statement-breakpoint
ALTER TABLE "project_wall_focus_step" ADD CONSTRAINT "project_wall_focus_step_item_id_project_wall_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."project_wall_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_wall_focus_step" ADD CONSTRAINT "project_wall_focus_step_wall_id_project_wall_id_fk" FOREIGN KEY ("wall_id") REFERENCES "public"."project_wall"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_wall_focus_step_position_uidx" ON "project_wall_focus_step" USING btree ("wall_id","position");--> statement-breakpoint
ALTER TABLE "project_wall_item" ADD CONSTRAINT "project_wall_item_source_type_check" CHECK ("project_wall_item"."source_type" in ('Work', 'Decision', 'Risk', 'Technical Diagram', 'Smart Collection'));