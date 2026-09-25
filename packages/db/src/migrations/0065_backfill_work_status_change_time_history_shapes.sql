-- Custom SQL migration file, put your code below! --
UPDATE "work" AS current_work
SET "status_changed_at" = COALESCE(
  (
    SELECT history."occurred_at"
    FROM "mutation_history" AS history
    WHERE history."target_id" = current_work."id"
      AND COALESCE(
        history."next_value" #>> '{work,status}',
        history."next_value" #>> '{status}'
      ) = current_work."status"
      AND COALESCE(
        history."next_value" #>> '{work,status}',
        history."next_value" #>> '{status}'
      ) IS DISTINCT FROM COALESCE(
        history."previous_value" #>> '{work,status}',
        history."previous_value" #>> '{status}'
      )
    ORDER BY history."revision" DESC, history."occurred_at" DESC
    LIMIT 1
  ),
  current_work."created_at"
);
