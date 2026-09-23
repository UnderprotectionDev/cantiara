-- Idempotently reconcile the Prioritization schema for fresh and historical databases.
-- Partial prerequisite schemas fail closed; existing complete tables remain untouched.
DO $$
DECLARE
	missing text[];
BEGIN
	IF to_regclass('public.project') IS NULL
		OR to_regclass('public.work') IS NULL
		OR to_regclass('public.workspace') IS NULL THEN
		RAISE EXCEPTION 'Prioritization schema repair requires project, work, and workspace';
	END IF;

	WITH expected(table_name, column_name, data_type, not_null) AS (
		VALUES
			('priority_metric_definition', 'created_at', 'timestamp without time zone', true),
			('priority_metric_definition', 'enabled', 'boolean', true),
			('priority_metric_definition', 'id', 'text', true),
			('priority_metric_definition', 'name', 'text', true),
			('priority_metric_definition', 'name_key', 'text', true),
			('priority_metric_definition', 'project_id', 'text', true),
			('priority_metric_definition', 'rank_descriptions', 'jsonb', true),
			('priority_metric_definition', 'revision', 'integer', true),
			('priority_metric_definition', 'short_description', 'text', true),
			('priority_metric_definition', 'trashed_at', 'timestamp without time zone', false),
			('priority_metric_definition', 'updated_at', 'timestamp without time zone', true),
			('work_priority_metric_value', 'created_at', 'timestamp without time zone', true),
			('work_priority_metric_value', 'id', 'text', true),
			('work_priority_metric_value', 'metric_id', 'text', true),
			('work_priority_metric_value', 'project_id', 'text', true),
			('work_priority_metric_value', 'rank', 'text', false),
			('work_priority_metric_value', 'revision', 'integer', true),
			('work_priority_metric_value', 'updated_at', 'timestamp without time zone', true),
			('work_priority_metric_value', 'work_id', 'text', true),
			('daily_focus_membership', 'created_at', 'timestamp without time zone', true),
			('daily_focus_membership', 'focus_date', 'date', true),
			('daily_focus_membership', 'id', 'text', true),
			('daily_focus_membership', 'work_id', 'text', true),
			('daily_focus_membership', 'workspace_id', 'text', true)
	)
	SELECT array_agg(expected.table_name || '.' || expected.column_name)
	INTO missing
	FROM expected
	WHERE NOT EXISTS (
		SELECT 1
		FROM pg_attribute
		JOIN pg_class ON pg_class.oid = pg_attribute.attrelid
		JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
		WHERE pg_namespace.nspname = 'public'
			AND pg_class.relname = expected.table_name
			AND pg_attribute.attname = expected.column_name
			AND pg_attribute.attnum > 0
			AND NOT pg_attribute.attisdropped
			AND pg_catalog.format_type(pg_attribute.atttypid, pg_attribute.atttypmod) = expected.data_type
			AND pg_attribute.attnotnull = expected.not_null
	);
	IF missing IS NOT NULL THEN
		RAISE EXCEPTION 'Prioritization schema repair found incomplete 0046–0048 columns: %', missing;
	END IF;

	WITH expected(table_name, constraint_name) AS (
		VALUES
			('priority_metric_definition', 'priority_metric_definition_pkey'),
			('priority_metric_definition', 'priority_metric_definition_project_id_uidx'),
			('priority_metric_definition', 'priority_metric_definition_name_check'),
			('priority_metric_definition', 'priority_metric_definition_short_description_check'),
			('priority_metric_definition', 'priority_metric_definition_rank_descriptions_check'),
			('priority_metric_definition', 'priority_metric_definition_revision_check'),
			('priority_metric_definition', 'priority_metric_definition_project_id_project_id_fk'),
			('work_priority_metric_value', 'work_priority_metric_value_pkey'),
			('work_priority_metric_value', 'work_priority_metric_value_rank_check'),
			('work_priority_metric_value', 'work_priority_metric_value_revision_check'),
			('work_priority_metric_value', 'work_priority_metric_value_project_metric_fk'),
			('work_priority_metric_value', 'work_priority_metric_value_project_work_fk'),
			('work', 'work_project_id_uidx'),
			('daily_focus_membership', 'daily_focus_membership_pkey'),
			('daily_focus_membership', 'daily_focus_membership_date_check'),
			('daily_focus_membership', 'daily_focus_membership_work_id_work_id_fk'),
			('daily_focus_membership', 'daily_focus_membership_workspace_id_workspace_id_fk')
	)
	SELECT array_agg(expected.constraint_name)
	INTO missing
	FROM expected
	WHERE NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
		JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
		WHERE pg_namespace.nspname = 'public'
			AND pg_class.relname = expected.table_name
			AND pg_constraint.conname = expected.constraint_name
	);
	IF missing IS NOT NULL THEN
		RAISE EXCEPTION 'Prioritization schema repair found incomplete 0046–0048 constraints: %', missing;
	END IF;

	WITH expected(table_name, index_name) AS (
		VALUES
			('priority_metric_definition', 'priority_metric_definition_project_idx'),
			('priority_metric_definition', 'priority_metric_definition_project_name_uidx'),
			('work_priority_metric_value', 'work_priority_metric_value_project_work_idx'),
			('work_priority_metric_value', 'work_priority_metric_value_work_metric_uidx'),
			('daily_focus_membership', 'daily_focus_membership_day_idx'),
			('daily_focus_membership', 'daily_focus_membership_work_day_uidx')
	)
	SELECT array_agg(expected.index_name)
	INTO missing
	FROM expected
	WHERE NOT EXISTS (
		SELECT 1
		FROM pg_indexes
		WHERE pg_indexes.schemaname = 'public'
			AND pg_indexes.tablename = expected.table_name
			AND pg_indexes.indexname = expected.index_name
	);
	IF missing IS NOT NULL THEN
		RAISE EXCEPTION 'Prioritization schema repair found incomplete 0046–0048 indexes: %', missing;
	END IF;

	WITH expected(table_name, column_name, data_type, not_null) AS (
		VALUES
			('project_backlog_order', 'project_id', 'text', true),
			('project_backlog_order', 'revision', 'integer', true),
			('project_backlog_order', 'updated_at', 'timestamp without time zone', true),
			('project_backlog_order', 'work_ids', 'jsonb', true),
			('prioritization_session', 'closed_at', 'timestamp without time zone', false),
			('prioritization_session', 'created_at', 'timestamp without time zone', true),
			('prioritization_session', 'id', 'text', true),
			('prioritization_session', 'name', 'text', true),
			('prioritization_session', 'project_id', 'text', true),
			('prioritization_session', 'revision', 'integer', true),
			('prioritization_session', 'trashed_at', 'timestamp without time zone', false),
			('prioritization_session', 'updated_at', 'timestamp without time zone', true),
			('prioritization_session_work', 'id', 'text', true),
			('prioritization_session_work', 'position', 'integer', true),
			('prioritization_session_work', 'project_id', 'text', true),
			('prioritization_session_work', 'session_id', 'text', true),
			('prioritization_session_work', 'work_id', 'text', true)
	)
	SELECT array_agg(expected.table_name || '.' || expected.column_name)
	INTO missing
	FROM expected
	WHERE to_regclass('public.' || expected.table_name) IS NOT NULL
		AND NOT EXISTS (
			SELECT 1
			FROM pg_attribute
			JOIN pg_class ON pg_class.oid = pg_attribute.attrelid
			JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
			WHERE pg_namespace.nspname = 'public'
				AND pg_class.relname = expected.table_name
				AND pg_attribute.attname = expected.column_name
				AND pg_attribute.attnum > 0
				AND NOT pg_attribute.attisdropped
				AND pg_catalog.format_type(pg_attribute.atttypid, pg_attribute.atttypmod) = expected.data_type
				AND pg_attribute.attnotnull = expected.not_null
		);
	IF missing IS NOT NULL THEN
		RAISE EXCEPTION 'Prioritization schema repair found incomplete tables: %', missing;
	END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_backlog_order" (
	"project_id" text PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"work_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "project_backlog_order_work_ids_check" CHECK (jsonb_typeof("project_backlog_order"."work_ids") = 'array'),
	CONSTRAINT "project_backlog_order_revision_check" CHECK ("project_backlog_order"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prioritization_session" (
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"project_id" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"trashed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "prioritization_session_project_id_uidx" UNIQUE("project_id","id"),
	CONSTRAINT "prioritization_session_name_check" CHECK (length(btrim("prioritization_session"."name")) between 1 and 200),
	CONSTRAINT "prioritization_session_revision_check" CHECK ("prioritization_session"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prioritization_session_work" (
	"id" text PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"project_id" text NOT NULL,
	"session_id" text NOT NULL,
	"work_id" text NOT NULL,
	CONSTRAINT "prioritization_session_work_position_check" CHECK ("prioritization_session_work"."position" >= 0)
);
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'project_backlog_order_pkey'
			AND conrelid = 'public.project_backlog_order'::regclass
	) THEN
		ALTER TABLE "project_backlog_order"
			ADD CONSTRAINT "project_backlog_order_pkey" PRIMARY KEY ("project_id");
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'project_backlog_order_work_ids_check'
			AND conrelid = 'public.project_backlog_order'::regclass
	) THEN
		ALTER TABLE "project_backlog_order"
			ADD CONSTRAINT "project_backlog_order_work_ids_check"
			CHECK (jsonb_typeof("work_ids") = 'array');
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'project_backlog_order_revision_check'
			AND conrelid = 'public.project_backlog_order'::regclass
	) THEN
		ALTER TABLE "project_backlog_order"
			ADD CONSTRAINT "project_backlog_order_revision_check"
			CHECK ("revision" >= 0);
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'project_backlog_order_project_id_project_id_fk'
			AND conrelid = 'public.project_backlog_order'::regclass
	) THEN
		ALTER TABLE "project_backlog_order"
			ADD CONSTRAINT "project_backlog_order_project_id_project_id_fk"
			FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'prioritization_session_pkey'
			AND conrelid = 'public.prioritization_session'::regclass
	) THEN
		ALTER TABLE "prioritization_session"
			ADD CONSTRAINT "prioritization_session_pkey" PRIMARY KEY ("id");
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'prioritization_session_project_id_uidx'
			AND conrelid = 'public.prioritization_session'::regclass
	) THEN
		ALTER TABLE "prioritization_session"
			ADD CONSTRAINT "prioritization_session_project_id_uidx" UNIQUE ("project_id", "id");
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'prioritization_session_name_check'
			AND conrelid = 'public.prioritization_session'::regclass
	) THEN
		ALTER TABLE "prioritization_session"
			ADD CONSTRAINT "prioritization_session_name_check"
			CHECK (length(btrim("name")) between 1 and 200);
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'prioritization_session_revision_check'
			AND conrelid = 'public.prioritization_session'::regclass
	) THEN
		ALTER TABLE "prioritization_session"
			ADD CONSTRAINT "prioritization_session_revision_check"
			CHECK ("revision" >= 0);
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'prioritization_session_project_id_project_id_fk'
			AND conrelid = 'public.prioritization_session'::regclass
	) THEN
		ALTER TABLE "prioritization_session"
			ADD CONSTRAINT "prioritization_session_project_id_project_id_fk"
			FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'prioritization_session_work_pkey'
			AND conrelid = 'public.prioritization_session_work'::regclass
	) THEN
		ALTER TABLE "prioritization_session_work"
			ADD CONSTRAINT "prioritization_session_work_pkey" PRIMARY KEY ("id");
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'prioritization_session_work_position_check'
			AND conrelid = 'public.prioritization_session_work'::regclass
	) THEN
		ALTER TABLE "prioritization_session_work"
			ADD CONSTRAINT "prioritization_session_work_position_check"
			CHECK ("position" >= 0);
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'prioritization_session_work_project_session_fk'
			AND conrelid = 'public.prioritization_session_work'::regclass
	) THEN
		ALTER TABLE "prioritization_session_work"
			ADD CONSTRAINT "prioritization_session_work_project_session_fk"
			FOREIGN KEY ("project_id", "session_id")
			REFERENCES "public"."prioritization_session"("project_id", "id")
			ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prioritization_session_project_idx" ON "prioritization_session" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prioritization_session_work_project_session_idx" ON "prioritization_session_work" USING btree ("project_id","session_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "prioritization_session_work_session_position_uidx" ON "prioritization_session_work" USING btree ("session_id","position");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "prioritization_session_work_session_work_uidx" ON "prioritization_session_work" USING btree ("session_id","work_id");
