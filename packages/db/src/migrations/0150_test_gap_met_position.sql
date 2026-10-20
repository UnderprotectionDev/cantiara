ALTER TABLE "project_test_gap_met_session_test" ADD COLUMN "position" integer;--> statement-breakpoint
-- Review fix: met rows created by migration 0145 encoded the founder's pick
-- order in the millisecond offset of `created_at`. Restore the same order as
-- an explicit `position`, so `created_at` stays a plain creation timestamp.
WITH ordered AS (
  SELECT row_number() OVER (PARTITION BY gap_id ORDER BY created_at, session_test_id) - 1 AS position, gap_id, session_test_id
  FROM "project_test_gap_met_session_test"
)
UPDATE "project_test_gap_met_session_test" SET "position" = ordered.position
FROM ordered
WHERE "project_test_gap_met_session_test"."gap_id" = ordered.gap_id
  AND "project_test_gap_met_session_test"."session_test_id" = ordered.session_test_id;
