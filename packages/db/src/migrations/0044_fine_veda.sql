ALTER TABLE "work_relation" ADD COLUMN "blocking_status" text;--> statement-breakpoint
UPDATE "work_relation" SET "blocking_status" = 'Active' WHERE "kind" = 'Blocks';--> statement-breakpoint
ALTER TABLE "work_relation" ADD CONSTRAINT "work_relation_blocking_status_check" CHECK (("work_relation"."kind" <> 'Blocks' and "work_relation"."blocking_status" is null) or ("work_relation"."kind" = 'Blocks' and "work_relation"."blocking_status" is not null and "work_relation"."blocking_status" in ('Active', 'Resolved')));
