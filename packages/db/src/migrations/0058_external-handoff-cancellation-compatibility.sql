-- Reconcile the cancellation reason schema without replaying an unrecorded
-- External Execution Handoff creation migration on an existing database.
DO $$
DECLARE
	expected_constraint text;
BEGIN
	IF to_regclass('public.work_external_execution_handoff') IS NULL THEN
		RAISE EXCEPTION 'External handoff cancellation repair requires work_external_execution_handoff';
	END IF;

	IF NOT EXISTS (
		SELECT 1
		FROM pg_attribute
		JOIN pg_class ON pg_class.oid = pg_attribute.attrelid
		JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
		WHERE pg_namespace.nspname = 'public'
			AND pg_class.relname = 'work_external_execution_handoff'
			AND pg_attribute.attname IN ('handoff_id', 'work_id', 'status')
			AND pg_attribute.attnum > 0
			AND NOT pg_attribute.attisdropped
		GROUP BY pg_class.relname
		HAVING count(DISTINCT pg_attribute.attname) = 3
	) THEN
		RAISE EXCEPTION 'External handoff cancellation repair found an incomplete handoff table';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM pg_attribute
		JOIN pg_class ON pg_class.oid = pg_attribute.attrelid
		JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
		WHERE pg_namespace.nspname = 'public'
			AND pg_class.relname = 'work_external_execution_handoff'
			AND pg_attribute.attname = 'cancellation_reason'
			AND pg_attribute.attnum > 0
			AND NOT pg_attribute.attisdropped
			AND pg_catalog.format_type(pg_attribute.atttypid, pg_attribute.atttypmod) <> 'text'
	) THEN
		RAISE EXCEPTION 'External handoff cancellation repair found an incompatible cancellation_reason column';
	END IF;

	IF NOT EXISTS (
		SELECT 1
		FROM pg_attribute
		JOIN pg_class ON pg_class.oid = pg_attribute.attrelid
		JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
		WHERE pg_namespace.nspname = 'public'
			AND pg_class.relname = 'work_external_execution_handoff'
			AND pg_attribute.attname = 'cancellation_reason'
			AND pg_attribute.attnum > 0
			AND NOT pg_attribute.attisdropped
	) THEN
		ALTER TABLE "work_external_execution_handoff"
			ADD COLUMN "cancellation_reason" text;
	END IF;

	IF EXISTS (
		SELECT 1
		FROM "work_external_execution_handoff"
		WHERE ("status" = 'Canceled' AND ("cancellation_reason" IS NULL OR length(btrim("cancellation_reason")) = 0))
			OR ("status" <> 'Canceled' AND "cancellation_reason" IS NOT NULL)
	) THEN
		RAISE EXCEPTION 'External handoff cancellation repair found status and reason data that cannot be reconciled safely';
	END IF;

	SELECT pg_get_constraintdef(pg_constraint.oid)
	INTO expected_constraint
	FROM pg_constraint
	WHERE pg_constraint.conname = 'work_external_handoff_cancellation_reason_check'
		AND pg_constraint.conrelid = 'public.work_external_execution_handoff'::regclass;
	IF expected_constraint IS NOT NULL
		AND (
			position('cancellation_reason' IN lower(expected_constraint)) = 0
			OR position('canceled' IN lower(expected_constraint)) = 0
			OR position('btrim' IN lower(expected_constraint)) = 0
			OR position('is not null' IN lower(expected_constraint)) = 0
			OR position('is null' IN lower(expected_constraint)) = 0
		) THEN
		RAISE EXCEPTION 'External handoff cancellation repair found an incompatible cancellation reason constraint';
	END IF;
	IF expected_constraint IS NULL THEN
		ALTER TABLE "work_external_execution_handoff"
			ADD CONSTRAINT "work_external_handoff_cancellation_reason_check"
			CHECK (("status" = 'Canceled' AND "cancellation_reason" IS NOT NULL AND length(btrim("cancellation_reason")) > 0) OR ("status" <> 'Canceled' AND "cancellation_reason" IS NULL));
	END IF;
END $$;
