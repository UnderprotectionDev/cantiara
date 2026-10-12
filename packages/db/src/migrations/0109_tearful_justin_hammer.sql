ALTER TABLE "evidence_binding" DROP CONSTRAINT "evidence_binding_source_project_id_project_id_fk";
--> statement-breakpoint
ALTER TABLE "evidence_binding" DROP CONSTRAINT "evidence_binding_target_project_id_project_id_fk";
--> statement-breakpoint
ALTER TABLE "evidence_binding" ALTER COLUMN "source_project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_binding" ALTER COLUMN "target_project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_binding" ADD CONSTRAINT "evidence_binding_source_project_id_project_id_fk" FOREIGN KEY ("source_project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_binding" ADD CONSTRAINT "evidence_binding_target_project_id_project_id_fk" FOREIGN KEY ("target_project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;